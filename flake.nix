{
  description = "Webb Protocol Solidity development environment";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    foundry = {
      url = "github:shazow/foundry.nix";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        flake-utils.follows = "flake-utils";
      };
    };
  };

  outputs = { self, nixpkgs, foundry, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ foundry.overlay ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "protocol-solidity";
          nativeBuildInputs = [ ];
          buildInputs = [
            # Nodejs for test suite
            pkgs.nodePackages.typescript-language-server
            pkgs.nodejs_18
            pkgs.nodePackages.yarn
            # Used for DVC
            pkgs.python311
            pkgs.python311Packages.pipx

            pkgs.foundry-bin
          ];
          packages = [ ];
        };
      });
}
