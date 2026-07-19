import type { Abi, Chain } from "viem";

import deploymentArtifact from "../polygonAmoy-1784375814730.json";
import xrdmArtifact from "../XRDM.json";
import xrdmImplementationArtifact from "../XRDMImplementation.json";

export const polygonAmoyChain = {
  blockExplorers: {
    default: {
      name: "PolygonScan Amoy",
      url: "https://amoy.polygonscan.com",
    },
  },
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: {
    decimals: 18,
    name: "POL",
    symbol: "POL",
  },
  rpcUrls: {
    default: {
      http: [
        "https://polygon-amoy-bor-rpc.publicnode.com",
        "https://rpc-amoy.polygon.technology",
      ],
    },
  },
  testnet: true,
} as const satisfies Chain;

export const polygonAmoyDeployment = {
  baseURI: deploymentArtifact.baseURI,
  chainId: Number(deploymentArtifact.chainId),
  corpImplementation: deploymentArtifact.corpImplementation,
  corpProxy: deploymentArtifact.corpProxy,
  deployedAt: deploymentArtifact.deployedAt,
  deployer: deploymentArtifact.deployer,
  eduImplementation: deploymentArtifact.eduImplementation,
  eduProxy: deploymentArtifact.eduProxy,
  network: deploymentArtifact.network,
  owner: deploymentArtifact.owner,
  xrdm: deploymentArtifact.xrdm,
} as const;

export const xrdmAbi = xrdmArtifact.abi as Abi;
export const xrdmImplementationAbi = xrdmImplementationArtifact.abi as Abi;
