// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {KovaCard, IPermitToken} from "../src/KovaCard.sol";

/// A minimal EIP-2612 dollar, standing in for AUSD.
contract Dollar {
    string public constant name = "Agora Dollar";
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public nonces;
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
    {
        require(block.timestamp <= deadline, "expired");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
            )
        );
        require(ecrecover(digest, v, r, s) == owner, "bad permit");
        allowance[owner][spender] = value;
    }
}

contract KovaCardTest is Test {
    Dollar dollar;
    KovaCard cards;

    uint256 holderKey = 0xA11CE;
    uint256 cardKey = 0xCA4D;
    uint256 cosignerKey = 0xC0516;
    address holder;
    address card;
    address cosigner;
    address shop = address(0x5409);

    uint96 constant LIMIT = 50e6;

    function setUp() public {
        vm.warp(1_760_000_000);
        holder = vm.addr(holderKey);
        card = vm.addr(cardKey);
        cosigner = vm.addr(cosignerKey);
        dollar = new Dollar();
        cards = new KovaCard(IPermitToken(address(dollar)), cosigner);
        dollar.mint(holder, 500e6);
    }

    // ── helpers ──

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _typed(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", cards.DOMAIN_SEPARATOR(), structHash));
    }

    function _permit(uint256 value) internal view returns (KovaCard.Permit memory p) {
        uint256 deadline = block.timestamp + 600;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                dollar.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        holder,
                        address(cards),
                        value,
                        dollar.nonces(holder),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holderKey, digest);
        p = KovaCard.Permit(value, deadline, v, r, s);
    }

    function _link(uint96 limit) internal {
        uint256 deadline = block.timestamp + 600;
        bytes memory holderSig = _sign(
            holderKey,
            _typed(keccak256(abi.encode(cards.LINK_TYPEHASH(), holder, card, limit, cards.nonces(holder), deadline)))
        );
        bytes memory cardSig =
            _sign(cardKey, _typed(keccak256(abi.encode(cards.CLAIM_TYPEHASH(), card, holder, deadline))));
        cards.link(holder, card, limit, deadline, holderSig, cardSig, _permit(type(uint256).max));
    }

    function _payment(uint256 amount, bytes32 memo) internal view returns (bytes32 digest, uint256 deadline) {
        deadline = block.timestamp + 60;
        digest = _typed(keccak256(abi.encode(cards.PAYMENT_TYPEHASH(), card, shop, amount, memo, deadline)));
    }

    function _pay(uint256 amount, bytes32 memo) internal {
        (bytes32 digest, uint256 deadline) = _payment(amount, memo);
        cards.pay(card, shop, amount, memo, deadline, _sign(cardKey, digest), _sign(cosignerKey, digest));
    }

    // ── linking ──

    function test_link_setsHolderLimitAndAllowance() public {
        _link(LIMIT);
        (address h, uint96 limit, uint96 spent, bool frozen, uint256 left) = cards.cardOf(card);
        assertEq(h, holder);
        assertEq(limit, LIMIT);
        assertEq(spent, 0);
        assertFalse(frozen);
        assertEq(left, LIMIT);
        assertEq(dollar.allowance(holder, address(cards)), type(uint256).max);
    }

    function test_link_needsTheCard() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory holderSig = _sign(
            holderKey, _typed(keccak256(abi.encode(cards.LINK_TYPEHASH(), holder, card, LIMIT, uint256(0), deadline)))
        );
        // Signed by someone else's key, not the card.
        bytes memory forged =
            _sign(0xBAD, _typed(keccak256(abi.encode(cards.CLAIM_TYPEHASH(), card, holder, deadline))));
        KovaCard.Permit memory p = _permit(1);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.link(holder, card, LIMIT, deadline, holderSig, forged, p);
    }

    function test_link_cardBelongsToOneWallet() public {
        _link(LIMIT);
        uint256 otherKey = 0xB0B;
        address other = vm.addr(otherKey);
        uint256 deadline = block.timestamp + 600;
        bytes memory otherSig = _sign(
            otherKey, _typed(keccak256(abi.encode(cards.LINK_TYPEHASH(), other, card, LIMIT, uint256(0), deadline)))
        );
        bytes memory cardSig =
            _sign(cardKey, _typed(keccak256(abi.encode(cards.CLAIM_TYPEHASH(), card, other, deadline))));
        KovaCard.Permit memory none;
        vm.expectRevert(KovaCard.CardTaken.selector);
        cards.link(other, card, LIMIT, deadline, otherSig, cardSig, none);
    }

    function test_link_survivesAFrontRunPermit() public {
        KovaCard.Permit memory p = _permit(type(uint256).max);
        // Someone submits the permit first: the link must still go through.
        dollar.permit(holder, address(cards), p.value, p.deadline, p.v, p.r, p.s);
        uint256 deadline = block.timestamp + 600;
        bytes memory holderSig = _sign(
            holderKey, _typed(keccak256(abi.encode(cards.LINK_TYPEHASH(), holder, card, LIMIT, uint256(0), deadline)))
        );
        bytes memory cardSig =
            _sign(cardKey, _typed(keccak256(abi.encode(cards.CLAIM_TYPEHASH(), card, holder, deadline))));
        cards.link(holder, card, LIMIT, deadline, holderSig, cardSig, p);
        (address h,,,,) = cards.cardOf(card);
        assertEq(h, holder);
    }

    function test_link_signatureWorksOnce() public {
        uint256 deadline = block.timestamp + 600;
        bytes memory holderSig = _sign(
            holderKey, _typed(keccak256(abi.encode(cards.LINK_TYPEHASH(), holder, card, LIMIT, uint256(0), deadline)))
        );
        bytes memory cardSig =
            _sign(cardKey, _typed(keccak256(abi.encode(cards.CLAIM_TYPEHASH(), card, holder, deadline))));
        KovaCard.Permit memory none;
        cards.link(holder, card, LIMIT, deadline, holderSig, cardSig, none);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.link(holder, card, LIMIT, deadline, holderSig, cardSig, none);
    }

    // ── paying ──

    function test_pay_movesMoneyFromWalletToShop() public {
        _link(LIMIT);
        bytes32 memo = keccak256("charge-1");
        vm.expectEmit(address(cards));
        emit KovaCard.CardPayment(card, holder, shop, 4.5e6, memo);
        _pay(4.5e6, memo);
        assertEq(dollar.balanceOf(shop), 4.5e6);
        assertEq(dollar.balanceOf(holder), 495.5e6);
        (,, uint96 spent,, uint256 left) = cards.cardOf(card);
        assertEq(spent, 4.5e6);
        assertEq(left, LIMIT - 4.5e6);
        assertTrue(cards.memoUsed(memo));
    }

    function test_pay_needsKova() public {
        _link(LIMIT);
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, cardSig, _sign(0xBAD, digest));
    }

    function test_pay_needsTheCard() public {
        _link(LIMIT);
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        // Kova alone can't spend from anyone's wallet.
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, _sign(cosignerKey, digest), _sign(cosignerKey, digest));
    }

    function test_pay_signaturesBindTheShopAndAmount() public {
        _link(LIMIT);
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        bytes memory kovaSig = _sign(cosignerKey, digest);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.pay(card, address(0xEE), 1e6, bytes32("m"), deadline, cardSig, kovaSig);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.pay(card, shop, 2e6, bytes32("m"), deadline, cardSig, kovaSig);
    }

    function test_pay_memoWorksOnce() public {
        _link(LIMIT);
        _pay(1e6, bytes32("m"));
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        bytes memory kovaSig = _sign(cosignerKey, digest);
        vm.expectRevert(KovaCard.MemoUsed.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, cardSig, kovaSig);
    }

    function test_pay_refusesHighS() public {
        _link(LIMIT);
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory twin = _twin(digest);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, twin, _sign(cosignerKey, digest));
    }

    /// The same signature with s flipped to the high half: valid for ecrecover, refused by Kova.
    function _twin(bytes32 digest) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(cardKey, digest);
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        return abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));
    }

    function test_pay_expires() public {
        _link(LIMIT);
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        bytes memory kovaSig = _sign(cosignerKey, digest);
        vm.warp(deadline + 1);
        vm.expectRevert(KovaCard.Expired.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, cardSig, kovaSig);
    }

    function test_pay_dailyLimitHoldsAndResetsAtMidnight() public {
        _link(LIMIT);
        _pay(30e6, bytes32("a"));
        (bytes32 digest, uint256 deadline) = _payment(25e6, bytes32("b"));
        bytes memory cardSig = _sign(cardKey, digest);
        bytes memory kovaSig = _sign(cosignerKey, digest);
        vm.expectRevert(abi.encodeWithSelector(KovaCard.OverDailyLimit.selector, uint256(20e6)));
        cards.pay(card, shop, 25e6, bytes32("b"), deadline, cardSig, kovaSig);

        vm.warp((block.timestamp / 1 days + 1) * 1 days + 1);
        _pay(25e6, bytes32("b"));
        (,, uint96 spent,,) = cards.cardOf(card);
        assertEq(spent, 25e6);
    }

    function test_pay_frozenCardPaysNothing() public {
        _link(LIMIT);
        vm.prank(holder);
        cards.updateDirect(card, LIMIT, true);
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        bytes memory kovaSig = _sign(cosignerKey, digest);
        vm.expectRevert(KovaCard.Frozen.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, cardSig, kovaSig);
        (,,,, uint256 left) = cards.cardOf(card);
        assertEq(left, 0);
    }

    function test_pay_rotatedCosignerTakesOver() public {
        _link(LIMIT);
        uint256 nextKey = 0xC0517;
        cards.setCosigner(vm.addr(nextKey));
        (bytes32 digest, uint256 deadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, cardSig, _sign(cosignerKey, digest));
        cards.pay(card, shop, 1e6, bytes32("m"), deadline, cardSig, _sign(nextKey, digest));
    }

    // ── holder controls ──

    function test_update_bySignature() public {
        _link(LIMIT);
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _sign(
            holderKey,
            _typed(
                keccak256(
                    abi.encode(
                        cards.UPDATE_TYPEHASH(), holder, card, uint96(10e6), true, cards.nonces(holder), deadline
                    )
                )
            )
        );
        cards.update(card, 10e6, true, deadline, sig);
        (, uint96 limit,, bool frozen,) = cards.cardOf(card);
        assertEq(limit, 10e6);
        assertTrue(frozen);
        // The same signature can't be replayed to undo a later change.
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.update(card, 10e6, true, deadline, sig);
    }

    function test_update_onlyTheHolder() public {
        _link(LIMIT);
        vm.expectRevert(KovaCard.NotHolder.selector);
        cards.updateDirect(card, 1_000e6, false);
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _sign(
            cosignerKey,
            _typed(
                keccak256(
                    abi.encode(
                        cards.UPDATE_TYPEHASH(), holder, card, uint96(1_000e6), false, cards.nonces(holder), deadline
                    )
                )
            )
        );
        vm.expectRevert(KovaCard.BadSignature.selector);
        cards.update(card, 1_000e6, false, deadline, sig);
    }

    function test_unlink_bySignatureThenCardIsUseless() public {
        _link(LIMIT);
        uint256 deadline = block.timestamp + 600;
        bytes memory sig = _sign(
            holderKey,
            _typed(keccak256(abi.encode(cards.UNLINK_TYPEHASH(), holder, card, cards.nonces(holder), deadline)))
        );
        cards.unlink(card, deadline, sig);
        (address h,,,,) = cards.cardOf(card);
        assertEq(h, address(0));
        (bytes32 digest, uint256 payDeadline) = _payment(1e6, bytes32("m"));
        bytes memory cardSig = _sign(cardKey, digest);
        bytes memory kovaSig = _sign(cosignerKey, digest);
        vm.expectRevert(KovaCard.UnknownCard.selector);
        cards.pay(card, shop, 1e6, bytes32("m"), payDeadline, cardSig, kovaSig);
    }

    function test_unlinkDirect_withoutKova() public {
        _link(LIMIT);
        vm.prank(holder);
        cards.unlinkDirect(card);
        (address h,,,,) = cards.cardOf(card);
        assertEq(h, address(0));
    }

    function test_cardOf_leftIsWhatTheWalletCanCover() public {
        _link(LIMIT);
        // Wallet drops to $3: the card can only spend $3 more, whatever its limit.
        vm.store(address(dollar), keccak256(abi.encode(holder, uint256(0))), bytes32(uint256(3e6)));
        (,,,, uint256 left) = cards.cardOf(card);
        assertEq(left, 3e6);
    }

    function test_onlyOwnerRotatesCosigner() public {
        vm.prank(holder);
        vm.expectRevert(KovaCard.NotOwner.selector);
        cards.setCosigner(holder);
    }
}
