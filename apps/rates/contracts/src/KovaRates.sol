// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @notice What Chainlink's forwarder calls with a report the DON agreed on.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title KovaRates
/// @notice Reference exchange rates for Kova on Monad, published by a Chainlink CRE workflow.
///
/// Kova never converts money: payments settle in dollars. It shows prices in naira, shillings,
/// euros, pounds and pesos so people can read them, and these are the rates it shows them at.
/// Every node of the DON fetches two independent sources, cross-checks them, and the DON writes
/// the median here. The app and the API read this contract instead of a fixed table.
///
/// A report is abi.encode(uint64 asOf, bytes3[] codes, uint256[] perUsdE8): how many units of
/// each currency one US dollar buys, scaled by 1e8, as of a unix time. A zero means the sources
/// disagreed for that currency, and the last good rate stands. An older report never overwrites a
/// newer rate, so a delayed or replayed report can't move a price backwards; a report dated in the
/// future is refused, so a bad clock can't freeze a rate until then.
contract KovaRates is IReceiver {
    struct Rate {
        uint192 perUsdE8;
        uint64 asOf;
    }

    /// @notice The Chainlink forwarder allowed to deliver reports.
    address public forwarder;
    address public owner;

    mapping(bytes3 code => Rate) public rates;
    bytes3[] private known;

    event RatesPublished(uint64 asOf, uint256 updated);
    event ForwarderChanged(address forwarder);
    event OwnerChanged(address owner);

    error NotForwarder(address sender);
    error NotOwner(address sender);
    error MalformedReport();
    error FutureReport(uint64 asOf, uint256 blockTime);

    /// @notice How far a report's time may run ahead of the block: the DON's clock and Monad's differ by seconds.
    uint256 public constant MAX_CLOCK_SKEW = 5 minutes;

    constructor(address forwarder_) {
        owner = msg.sender;
        forwarder = forwarder_;
        emit OwnerChanged(msg.sender);
        emit ForwarderChanged(forwarder_);
    }

    /// @inheritdoc IReceiver
    function onReport(bytes calldata, bytes calldata report) external {
        if (msg.sender != forwarder) revert NotForwarder(msg.sender);
        (uint64 asOf, bytes3[] memory codes, uint256[] memory values) = abi.decode(report, (uint64, bytes3[], uint256[]));
        if (codes.length != values.length) revert MalformedReport();
        if (asOf > block.timestamp + MAX_CLOCK_SKEW) revert FutureReport(asOf, block.timestamp);

        uint256 updated;
        for (uint256 i; i < codes.length; ++i) {
            uint256 value = values[i];
            if (value == 0 || value > type(uint192).max) continue;
            Rate storage rate = rates[codes[i]];
            if (asOf <= rate.asOf) continue;
            if (rate.asOf == 0) known.push(codes[i]);
            rate.perUsdE8 = uint192(value);
            rate.asOf = asOf;
            ++updated;
        }
        emit RatesPublished(asOf, updated);
    }

    /// @notice One currency: units per US dollar (1e8) and when it was true.
    function rateOf(bytes3 code) external view returns (uint256 perUsdE8, uint64 asOf) {
        Rate memory rate = rates[code];
        return (rate.perUsdE8, rate.asOf);
    }

    /// @notice Every currency published so far, in one call.
    function allRates() external view returns (bytes3[] memory codes, uint256[] memory perUsdE8, uint64[] memory asOf) {
        uint256 n = known.length;
        codes = new bytes3[](n);
        perUsdE8 = new uint256[](n);
        asOf = new uint64[](n);
        for (uint256 i; i < n; ++i) {
            Rate memory rate = rates[known[i]];
            codes[i] = known[i];
            perUsdE8[i] = rate.perUsdE8;
            asOf[i] = rate.asOf;
        }
    }

    /// @notice Moves delivery to another forwarder: the simulator's while testing, the DON's in production.
    function setForwarder(address forwarder_) external {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        forwarder = forwarder_;
        emit ForwarderChanged(forwarder_);
    }

    function setOwner(address owner_) external {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        owner = owner_;
        emit OwnerChanged(owner_);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
