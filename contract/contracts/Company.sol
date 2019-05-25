pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "./DataSource.sol";
import "./MockDAI.sol";

contract Company is Ownable {
    using SafeMath for uint256;

    DataSource public idp;
    MockDAI public mdai;

    uint256 public studentIncentive = 1;
    uint256 public schoolIncentive = 1;

    mapping (address => bool) public studentWhitelist;
    mapping (address => string) public studentInfo;
    mapping (address => uint256) public recentClaim;

    constructor(DataSource _idp, MockDAI _mdai) public {
        setIdentityProvider(_idp);
        setTokenForPayment(_mdai);
    }

    modifier requireIdentity() {
        require(idp.getAsBool.value(idp.getQueryPrice())(bytes32(bytes20(msg.sender))));
        _;
    }

    function setIdentityProvider(DataSource _idp) public onlyOwner {
        idp = _idp;
    }

    function setTokenForPayment(MockDAI _mdai) public onlyOwner {
        mdai = _mdai;
    }

    function getStudent(address student) public view returns(bool, string memory, uint256) {
        return (
            studentWhitelist[student],
            studentInfo[student],
            recentClaim[student]
        );
    }

    function getTokenBalance() public view returns(uint256) {
        return mdai.balanceOf(address(this));
    }

    function addStudent(address student, string memory info) public onlyOwner {
        require(!studentWhitelist[student]);
        studentWhitelist[student] = true;
        studentInfo[student] = info;
    }

    function updateStudentInfo(address student, string memory newInfo) public onlyOwner {
        require(studentWhitelist[student]);
        studentInfo[student] = newInfo;
    }

    function removeStudent(address student) public onlyOwner {
        require(studentWhitelist[student]);
        studentWhitelist[student] = false;
    }

    function setStudentIncentive(uint256 value) public onlyOwner {
        studentIncentive = value;
    }

    function setSchoolIncentive(uint256 value) public onlyOwner {
        schoolIncentive = value;
    }

    function resetClaim(address student) public onlyOwner {
        recentClaim[student] = 0;
    }

    function deposit(uint256 value) public onlyOwner {
        mdai.transferFrom(msg.sender, address(this), value);
    }

    function withdraw(uint256 value) public onlyOwner {
        mdai.transfer(msg.sender, value);
    }

    function recoverStudentAddressFromSignature(uint256 timestamp, bytes memory studentSig) public pure returns(address) {
        bytes32 hash = ECDSA.toEthSignedMessageHash(keccak256(abi.encodePacked(timestamp)));
        return ECDSA.recover(hash, studentSig);
    }

    function claimReward(uint256 timestamp, bytes memory studentSig) public requireIdentity {
        address student = recoverStudentAddressFromSignature(timestamp, studentSig);
        require(studentWhitelist[student]);
        uint256 duration = now.sub(recentClaim[student]);
        require(duration >= 1 days);
        require(timestamp <= now && timestamp >= now.sub(10 minutes));

        mdai.transfer(student, studentIncentive);
        mdai.transfer(msg.sender, schoolIncentive);

        recentClaim[student] = now;
    }
}
