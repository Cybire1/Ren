// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/// @notice The parts of AUSD (and any EIP-2612 dollar) the card needs.
interface IPermitToken {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
}

/// @title KovaCard
/// @notice Tap-to-pay cards for Kova wallets on Monad.
///
/// A Kova Card is an NFC chip (an Arx HaLo) holding a secp256k1 key it made itself and never
/// reveals. Linking a card lets it spend from its holder's wallet, so there is no card balance to
/// top up: the dollars stay in the wallet until a tap moves them, straight to the shop.
///
/// A tap moves money only when three things agree:
///   1. the card signed this exact payment (to whom, how much, which charge), so the card was there;
///   2. Kova's cosigner signed it too, after its own checks (PIN, frozen, Kova terminals only),
///      so a stolen card or a rogue reader gets nothing, and Kova can freeze a card instantly;
///   3. it fits the daily limit the holder set here, which nobody but the holder can raise.
///
/// Kova never holds anyone's money and cannot move it alone: the cosigner can't sign for a card.
/// The holder can always freeze, change the limit or unlink, by signature (relayed by Kova, no
/// gas) or by calling directly, without Kova.
///
/// Each payment carries the charge's Kova memo, recorded in CardPayment and usable once, which is
/// how Kova matches the transfer to the charge it pays.
contract KovaCard {
    struct Card {
        address holder;
        uint96 dailyLimit;
        uint96 spentToday;
        uint32 day;
        bool frozen;
    }

    struct Permit {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    IPermitToken public immutable token;
    address public owner;
    address public cosigner;

    mapping(address card => Card) private _cards;
    /// @notice Per-holder counter: each link, update or unlink signature works once.
    mapping(address holder => uint256) public nonces;
    mapping(bytes32 memo => bool) public memoUsed;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant LINK_TYPEHASH =
        keccak256("Link(address holder,address card,uint96 dailyLimit,uint256 nonce,uint256 deadline)");
    bytes32 public constant CLAIM_TYPEHASH = keccak256("Claim(address card,address holder,uint256 deadline)");
    bytes32 public constant UPDATE_TYPEHASH =
        keccak256("Update(address holder,address card,uint96 dailyLimit,bool frozen,uint256 nonce,uint256 deadline)");
    bytes32 public constant UNLINK_TYPEHASH =
        keccak256("Unlink(address holder,address card,uint256 nonce,uint256 deadline)");
    bytes32 public constant PAYMENT_TYPEHASH =
        keccak256("Payment(address card,address to,uint256 amount,bytes32 memo,uint256 deadline)");

    bytes32 private immutable _domainSeparator;
    uint256 private immutable _chainId;

    /// @dev secp256k1 n / 2: a signature with a higher s is the malleable twin of a valid one.
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    event CardLinked(address indexed card, address indexed holder, uint96 dailyLimit);
    event CardUpdated(address indexed card, address indexed holder, uint96 dailyLimit, bool frozen);
    event CardUnlinked(address indexed card, address indexed holder);
    event CardPayment(address indexed card, address indexed holder, address indexed to, uint256 amount, bytes32 memo);
    event CosignerChanged(address cosigner);
    event OwnerChanged(address owner);

    error NotOwner();
    error NotHolder();
    error Expired();
    error BadSignature();
    error CardTaken();
    error UnknownCard();
    error Frozen();
    error OverDailyLimit(uint256 left);
    error MemoUsed();
    error ZeroAmount();
    error TransferFailed();

    constructor(IPermitToken token_, address cosigner_) {
        token = token_;
        owner = msg.sender;
        cosigner = cosigner_;
        _chainId = block.chainid;
        _domainSeparator = _buildDomainSeparator();
        emit OwnerChanged(msg.sender);
        emit CosignerChanged(cosigner_);
    }

    // ── Holder: link, update, unlink ────────────────────────────────────────────────────────────

    /// @notice Links a card to a wallet. The holder signs `Link`, the card signs `Claim` (so nobody
    /// can link a card they don't hold), and `permit` lets this contract draw on the wallet, which it
    /// does only for payments that pass every check in `pay`. A permit already used, or one a
    /// front-runner submitted first, is skipped: the allowance is what matters.
    function link(
        address holder,
        address card,
        uint96 dailyLimit,
        uint256 deadline,
        bytes calldata holderSignature,
        bytes calldata cardSignature,
        Permit calldata permit
    ) external {
        if (block.timestamp > deadline) revert Expired();
        Card storage c = _cards[card];
        if (c.holder != address(0) && c.holder != holder) revert CardTaken();

        uint256 nonce = nonces[holder]++;
        _expect(
            holder, keccak256(abi.encode(LINK_TYPEHASH, holder, card, dailyLimit, nonce, deadline)), holderSignature
        );
        _expect(card, keccak256(abi.encode(CLAIM_TYPEHASH, card, holder, deadline)), cardSignature);

        if (permit.deadline != 0) {
            try token.permit(holder, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }

        c.holder = holder;
        c.dailyLimit = dailyLimit;
        c.frozen = false;
        emit CardLinked(card, holder, dailyLimit);
    }

    /// @notice Changes a card's limit or freezes it, signed by the holder and relayed by anyone.
    function update(address card, uint96 dailyLimit, bool frozen, uint256 deadline, bytes calldata holderSignature)
        external
    {
        if (block.timestamp > deadline) revert Expired();
        Card storage c = _cards[card];
        address holder = c.holder;
        if (holder == address(0)) revert UnknownCard();
        uint256 nonce = nonces[holder]++;
        _expect(
            holder,
            keccak256(abi.encode(UPDATE_TYPEHASH, holder, card, dailyLimit, frozen, nonce, deadline)),
            holderSignature
        );
        _update(c, card, dailyLimit, frozen);
    }

    /// @notice The same, called by the holder directly: works even if Kova is gone.
    function updateDirect(address card, uint96 dailyLimit, bool frozen) external {
        Card storage c = _cards[card];
        if (c.holder == address(0)) revert UnknownCard();
        if (c.holder != msg.sender) revert NotHolder();
        _update(c, card, dailyLimit, frozen);
    }

    /// @notice Unlinks a card for good, signed by the holder and relayed by anyone.
    function unlink(address card, uint256 deadline, bytes calldata holderSignature) external {
        if (block.timestamp > deadline) revert Expired();
        address holder = _cards[card].holder;
        if (holder == address(0)) revert UnknownCard();
        uint256 nonce = nonces[holder]++;
        _expect(holder, keccak256(abi.encode(UNLINK_TYPEHASH, holder, card, nonce, deadline)), holderSignature);
        _unlink(card, holder);
    }

    function unlinkDirect(address card) external {
        address holder = _cards[card].holder;
        if (holder == address(0)) revert UnknownCard();
        if (holder != msg.sender) revert NotHolder();
        _unlink(card, holder);
    }

    // ── Paying ──────────────────────────────────────────────────────────────────────────────────

    /// @notice A tap: moves `amount` from the card holder's wallet to `to`, for the charge `memo`.
    /// Both the card and Kova's cosigner sign the same Payment.
    function pay(
        address card,
        address to,
        uint256 amount,
        bytes32 memo,
        uint256 deadline,
        bytes calldata cardSignature,
        bytes calldata cosignerSignature
    ) external {
        if (block.timestamp > deadline) revert Expired();
        if (amount == 0) revert ZeroAmount();
        if (memoUsed[memo]) revert MemoUsed();
        Card storage c = _cards[card];
        address holder = c.holder;
        if (holder == address(0)) revert UnknownCard();
        if (c.frozen) revert Frozen();

        bytes32 digest = _hashTypedData(keccak256(abi.encode(PAYMENT_TYPEHASH, card, to, amount, memo, deadline)));
        if (_recover(digest, cardSignature) != card) revert BadSignature();
        if (_recover(digest, cosignerSignature) != cosigner) revert BadSignature();

        uint32 today = uint32(block.timestamp / 1 days);
        uint256 spent = c.day == today ? c.spentToday : 0;
        if (spent + amount > c.dailyLimit) revert OverDailyLimit(c.dailyLimit > spent ? c.dailyLimit - spent : 0);
        c.day = today;
        c.spentToday = uint96(spent + amount);
        memoUsed[memo] = true;

        if (!token.transferFrom(holder, to, amount)) revert TransferFailed();
        emit CardPayment(card, holder, to, amount, memo);
    }

    // ── Reading ─────────────────────────────────────────────────────────────────────────────────

    /// @notice A card's holder, limit, what it has spent today (UTC) and what is left.
    function cardOf(address card)
        external
        view
        returns (address holder, uint96 dailyLimit, uint96 spentToday, bool frozen, uint256 left)
    {
        Card memory c = _cards[card];
        uint96 spent = c.day == uint32(block.timestamp / 1 days) ? c.spentToday : 0;
        uint256 limitLeft = c.dailyLimit > spent ? c.dailyLimit - spent : 0;
        if (c.holder != address(0)) {
            // What the wallet can actually cover: its balance and what it has allowed this contract.
            uint256 balance = token.balanceOf(c.holder);
            uint256 allowed = token.allowance(c.holder, address(this));
            if (balance < limitLeft) limitLeft = balance;
            if (allowed < limitLeft) limitLeft = allowed;
        }
        return (c.holder, c.dailyLimit, spent, c.frozen, c.frozen ? 0 : limitLeft);
    }

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return block.chainid == _chainId ? _domainSeparator : _buildDomainSeparator();
    }

    // ── Kova ────────────────────────────────────────────────────────────────────────────────────

    /// @notice Rotates Kova's cosigning key. A cosigner can only refuse payments, never make one:
    /// every payment also needs the card.
    function setCosigner(address cosigner_) external {
        if (msg.sender != owner) revert NotOwner();
        cosigner = cosigner_;
        emit CosignerChanged(cosigner_);
    }

    function setOwner(address owner_) external {
        if (msg.sender != owner) revert NotOwner();
        owner = owner_;
        emit OwnerChanged(owner_);
    }

    // ── Internals ───────────────────────────────────────────────────────────────────────────────

    function _update(Card storage c, address card, uint96 dailyLimit, bool frozen) private {
        c.dailyLimit = dailyLimit;
        c.frozen = frozen;
        emit CardUpdated(card, c.holder, dailyLimit, frozen);
    }

    function _unlink(address card, address holder) private {
        delete _cards[card];
        emit CardUnlinked(card, holder);
    }

    function _expect(address signer, bytes32 structHash, bytes calldata signature) private view {
        if (_recover(_hashTypedData(structHash), signature) != signer) revert BadSignature();
    }

    function _hashTypedData(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return
            keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("Kova Card"), keccak256("1"), block.chainid, address(this)));
    }

    /// @dev 65-byte r ‖ s ‖ v signatures, low s only. Returns zero for anything malformed, which
    /// never equals a card, a holder or the cosigner.
    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (v < 27) v += 27;
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
