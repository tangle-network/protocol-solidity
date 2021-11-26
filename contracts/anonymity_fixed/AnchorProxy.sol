// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0; //why does tornadoproxy uses between 0.6.0 and 0.8.0?
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IAnchor.sol";
import "../interfaces/IAnchorTrees.sol";

contract AnchorProxy {
  using SafeERC20 for IERC20;

  event InstanceStateUpdated(IAnchor indexed instance, InstanceState state);
  event AnchorProxyDeposit(IAnchor indexed anchor, bytes32 indexed commitment, uint256 timestamp);

  enum InstanceState { DISABLED, ENABLED, MINEABLE }

  event EncryptedNote(address indexed sender, bytes encryptedNote);
  
  struct Instance {
    IERC20 token;
    InstanceState state;
  }

  struct AnchorStruct {
    IAnchor addr;
    Instance instance;
  }

  IAnchorTrees public anchorTrees;
  mapping(IAnchor => Instance) public instances;
  address public immutable governance;

  modifier onlyGovernance() {
    require(msg.sender == governance, "Not authorized");
    _;
  }

  constructor(
    address _anchorTrees,
    address _governance,
    AnchorStruct[] memory _instances
  ) public {
    anchorTrees = IAnchorTrees(_anchorTrees);
    governance = _governance;

    for (uint256 i = 0; i < _instances.length; i++) {
      _updateInstance(_instances[i]);
    }
  }

  function deposit(
    IAnchor _anchor,
    bytes32 _commitment,
    bytes calldata _encryptedNote
  ) public payable virtual {
    Instance memory instance = instances[_anchor];
    require(instance.state != InstanceState.DISABLED, "The instance is not supported");

    
    instance.token.safeTransferFrom(msg.sender, address(this), _anchor.getDenomination()); //is .denomination correct?
    
    _anchor.deposit{ value: msg.value }(_commitment);

    if (instance.state == InstanceState.MINEABLE) {
      anchorTrees.registerDeposit(address(_anchor), _commitment);
    }
    emit EncryptedNote(msg.sender, _encryptedNote);
    emit AnchorProxyDeposit(_anchor, _commitment, block.timestamp);
  }


  function withdraw(
    IAnchor _anchor,
    bytes calldata _proof,
    IAnchor.PublicInputs calldata _publicInputs
  ) public payable virtual {
    Instance memory instance = instances[_anchor];
    require(instance.state != InstanceState.DISABLED, "The instance is not supported");

    _anchor.withdraw{ value: msg.value }(_proof, _publicInputs); 
    if (instance.state == InstanceState.MINEABLE) {
      anchorTrees.registerWithdrawal(address(_anchor), _publicInputs._nullifierHash); //nh change
    }
  }

  function _updateInstance(AnchorStruct memory _anchor) internal {
    instances[_anchor.addr] = _anchor.instance;
    
    IERC20 token = IERC20(_anchor.addr.getToken());
    require(token == _anchor.instance.token, "Incorrect token");
    uint256 allowance = token.allowance(address(this), address(_anchor.addr));

    if (_anchor.instance.state != InstanceState.DISABLED && allowance == 0) {
        token.safeApprove(address(_anchor.addr), type(uint256).max);
    } else if (_anchor.instance.state == InstanceState.DISABLED && allowance != 0) {
        token.safeApprove(address(_anchor.addr), 0);
    }
    emit InstanceStateUpdated(_anchor.addr, _anchor.instance.state);
  }

  function backupNotes(bytes[] calldata _encryptedNotes) external virtual {
    for (uint256 i = 0; i < _encryptedNotes.length; i++) {
      emit EncryptedNote(msg.sender, _encryptedNotes[i]);
    }
  }
  
}
