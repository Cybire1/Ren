// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {KovaCard, IPermitToken} from "../src/KovaCard.sol";

/// Deploys KovaCard for AUSD. COSIGNER is the address of KOVA_CARD_COSIGNER_KEY.
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --private-key $KEY --broadcast
/// Testnet AUSD: 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC. Mainnet AUSD: 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a.
contract Deploy is Script {
    function run() external returns (KovaCard card) {
        address token = vm.envAddress("AUSD");
        address cosigner = vm.envAddress("COSIGNER");
        vm.startBroadcast();
        card = new KovaCard(IPermitToken(token), cosigner);
        vm.stopBroadcast();
        console.log("KovaCard", address(card));
    }
}
