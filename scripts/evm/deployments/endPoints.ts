export type EndPointConfig = {
    httpEndpoint: string,
    wsEndpoint: string,
    name: string
  }

export const polygonEndPoints: EndPointConfig = { 
    httpEndpoint: process.env.MUMBAI_TESTNET_HTTPS_URL!,
    wsEndpoint: process.env.MUMBAI_TESTNET_WSS_URL!,
    name: "mumbai"
};

export const sepoliaEndPoints: EndPointConfig = { 
    httpEndpoint: process.env.SEPOLIA_HTTPS_URL!,
    wsEndpoint: process.env.SEPOLIA_WSS_URL!,
    name: "sepolia"
};

export const optimismEndPoints: EndPointConfig = { 
    httpEndpoint: process.env.OPTIMISM_TESTNET_HTTPS_URL!,
    wsEndpoint: process.env.OPTIMISM_TESTNET_WSS_URL!,
    name: "optimism"
};

export const moonbaseEndPoints: EndPointConfig = { 
    httpEndpoint: process.env.MOONBASE_HTTPS_URL!,
    wsEndpoint: process.env.MOONBASE_WSS_URL!,
    name: "moonbase"
};

export const goerliEndPoints: EndPointConfig = { 
    httpEndpoint: process.env.GOERLI_HTTPS_URL!,
    wsEndpoint: process.env.GOERLI_WSS_URL!,
    name: "goerli"
};


