// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {KovaRates, IReceiver, IERC165} from "../src/KovaRates.sol";

contract KovaRatesTest is Test {
    KovaRates rates;
    address forwarder = makeAddr("forwarder");

    function setUp() public {
        rates = new KovaRates(forwarder);
    }

    function report(uint64 asOf, bytes3[] memory codes, uint256[] memory values) internal pure returns (bytes memory) {
        return abi.encode(asOf, codes, values);
    }

    function two(bytes3 a, bytes3 b) internal pure returns (bytes3[] memory codes) {
        codes = new bytes3[](2);
        codes[0] = a;
        codes[1] = b;
    }

    function pair(uint256 a, uint256 b) internal pure returns (uint256[] memory v) {
        v = new uint256[](2);
        v[0] = a;
        v[1] = b;
    }

    function test_publishesRatesFromTheForwarder() public {
        vm.prank(forwarder);
        rates.onReport("", report(1_790_000_000, two("NGN", "EUR"), pair(1_375e8, 0.92e8)));
        (uint256 ngn, uint64 asOf) = rates.rateOf("NGN");
        assertEq(ngn, 1_375e8);
        assertEq(asOf, 1_790_000_000);
        (bytes3[] memory codes, uint256[] memory perUsd,) = rates.allRates();
        assertEq(codes.length, 2);
        assertEq(perUsd[1], 0.92e8);
    }

    function test_refusesAnyoneButTheForwarder() public {
        vm.expectRevert(abi.encodeWithSelector(KovaRates.NotForwarder.selector, address(this)));
        rates.onReport("", report(1, two("NGN", "EUR"), pair(1, 1)));
    }

    function test_anOlderReportNeverMovesAPriceBack() public {
        vm.startPrank(forwarder);
        rates.onReport("", report(200, two("NGN", "EUR"), pair(1_400e8, 0.9e8)));
        rates.onReport("", report(100, two("NGN", "EUR"), pair(1_300e8, 0.8e8)));
        vm.stopPrank();
        (uint256 ngn, uint64 asOf) = rates.rateOf("NGN");
        assertEq(ngn, 1_400e8);
        assertEq(asOf, 200);
    }

    function test_aDisagreementKeepsTheLastGoodRate() public {
        vm.startPrank(forwarder);
        rates.onReport("", report(100, two("NGN", "EUR"), pair(1_375e8, 0.92e8)));
        rates.onReport("", report(200, two("NGN", "EUR"), pair(0, 0.93e8)));
        vm.stopPrank();
        (uint256 ngn, uint64 ngnAsOf) = rates.rateOf("NGN");
        (uint256 eur,) = rates.rateOf("EUR");
        assertEq(ngn, 1_375e8);
        assertEq(ngnAsOf, 100);
        assertEq(eur, 0.93e8);
        (bytes3[] memory codes,,) = rates.allRates();
        assertEq(codes.length, 2, "a currency is listed once");
    }

    function test_onlyTheOwnerMovesTheForwarder() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(KovaRates.NotOwner.selector, stranger));
        rates.setForwarder(stranger);
        rates.setForwarder(stranger);
        assertEq(rates.forwarder(), stranger);
    }

    function test_saysItIsAReceiver() public view {
        assertTrue(rates.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(rates.supportsInterface(type(IERC165).interfaceId));
        assertFalse(rates.supportsInterface(0xffffffff));
    }
}
