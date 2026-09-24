// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {KovaRates} from "../src/KovaRates.sol";

/// Deploys KovaRates to Monad testnet, delivering through CRE's simulation forwarder so
/// `cre workflow simulate --broadcast` can publish real rates. setForwarder moves it to the
/// DON's forwarder (0xF8344CFd5c43616a4366C34E3EEE75af79a74482) once the workflow is deployed.
contract Deploy is Script {
    address constant SIMULATION_FORWARDER = 0xB9F79d863261869B234c481D1f9A7af84AeAd192;

    function run() external returns (KovaRates rates) {
        vm.startBroadcast();
        rates = new KovaRates(SIMULATION_FORWARDER);
        vm.stopBroadcast();
        console.log("KovaRates", address(rates));
    }
}
