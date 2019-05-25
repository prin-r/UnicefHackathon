const { shouldFail, time } = require('openzeppelin-test-helpers');
require('chai').should();

const MockIdentityProvider = artifacts.require('MockIdentityProvider');
const Company = artifacts.require('Company');
const MockDAI = artifacts.require('MockDAI');
const Web3 = require('web3');
const myweb3 = new Web3(web3.eth.currentProvider);

const signTime = async (time, user) => {
  const sig = await myweb3.eth.sign(myweb3.utils.soliditySha3(time + ''), user);
  console.log(
    myweb3.version,
    'yo',
    sig,
    time,
    user,
    myweb3.utils.soliditySha3(time + ''),
  );
  return sig;
};

const addr2B32 = x => {
  const p0 = y => (y.length < 66 ? p0(y + '0') : y);
  return p0(x).toLowerCase();
};

const _now = () => Math.floor(Date.now() / 1000);

contract('Company', ([owner, alice, bob, carol]) => {
  beforeEach(async () => {
    this.mip = await MockIdentityProvider.new({ from: owner });
    this.dai = await MockDAI.new({ from: owner });
    this.com = await Company.new(this.mip.address, this.dai.address, {
      from: owner,
    });
  });
  context('Context MockIdentityProvider', () => {
    it('Should convert addr to b32 correctly', async () => {
      (await this.mip.addr2B32(owner)).toString().should.eq(addr2B32(owner));
      (await this.mip.addr2B32(alice)).toString().should.eq(addr2B32(alice));
      (await this.mip.addr2B32(bob)).toString().should.eq(addr2B32(bob));
      (await this.mip.addr2B32(carol)).toString().should.eq(addr2B32(carol));
    });
    it('No one should have an identity at the beginning', async () => {
      (await this.mip.identities(addr2B32(owner)))
        .toString()
        .should.eq('false');
      (await this.mip.identities(addr2B32(alice)))
        .toString()
        .should.eq('false');
      (await this.mip.identities(addr2B32(bob))).toString().should.eq('false');
      (await this.mip.identities(addr2B32(carol)))
        .toString()
        .should.eq('false');
    });
    it('Alice should have an identity after she has been added', async () => {
      (await this.mip.identities(addr2B32(alice)))
        .toString()
        .should.eq('false');

      await this.mip.addMe({ from: alice });
      (await this.mip.identities(addr2B32(alice))).toString().should.eq('true');
    });
    it('Anyone should be able to get query price', async () => {
      (await this.mip.getQueryPrice()).toString().should.eq('0');
    });
    it('Only owner should be able to set query price', async () => {
      await this.mip.setQueryPrice(20, { from: owner });
      (await this.mip.getQueryPrice()).toString().should.eq('20');

      await shouldFail.reverting(this.mip.setQueryPrice(99, { from: alice }));
      await shouldFail.reverting(this.mip.setQueryPrice(99, { from: bob }));
      await shouldFail.reverting(this.mip.setQueryPrice(99, { from: carol }));
      (await this.mip.getQueryPrice()).toString().should.eq('20');
    });
  });
  context('Company', () => {
    beforeEach('initialization', async () => {
      await this.dai.mint(owner, 100, { from: owner });
      await this.dai.approve(this.com.address, 1000, { from: owner });
    });
    it('Check Datasource', async () => {
      (await this.com.idp()).toString().should.eq(this.mip.address);
    });
    it('Check Token', async () => {
      (await this.com.mdai()).toString().should.eq(this.dai.address);
    });
    it('Only owner can set the datasource', async () => {
      (await this.com.idp()).toString().should.eq(this.mip.address);

      const otherMip = await MockIdentityProvider.new({ from: alice });
      await this.com.setIdentityProvider(otherMip.address, { from: owner });

      (await this.com.idp()).toString().should.eq(otherMip.address);

      // ================================================================

      await shouldFail.reverting(
        this.com.setIdentityProvider(this.mip.address, { from: alice }),
      );

      (await this.com.idp()).toString().should.eq(otherMip.address);
    });
    it('Only owner can set the token', async () => {
      (await this.com.mdai()).toString().should.eq(this.dai.address);

      const otherToken = await MockDAI.new({ from: alice });
      await this.com.setTokenForPayment(otherToken.address, { from: owner });

      (await this.com.mdai()).toString().should.eq(otherToken.address);

      // ================================================================

      await shouldFail.reverting(
        this.com.setTokenForPayment(this.dai.address, { from: alice }),
      );

      (await this.com.mdai()).toString().should.eq(otherToken.address);
    });
    it('Check getTokenBalance', async () => {
      (await this.com.getTokenBalance()).toString().should.eq('0');
      await this.dai.transfer(this.com.address, 30, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('30');
    });
    it('Only owner can add student', async () => {
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
      await this.com.addStudent(alice, '1,alice,a', { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');

      (await this.com.studentInfo(alice)).toString().should.eq('1,alice,a');

      // ================================================================

      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await shouldFail.reverting(
        this.com.addStudent(bob, '2,bob,b', { from: alice }),
      );
      await shouldFail.reverting(
        this.com.addStudent(bob, '2,bob,b', { from: bob }),
      );
      await shouldFail.reverting(
        this.com.addStudent(bob, '2,bob,b', { from: carol }),
      );
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
    });
    it('Only owner can update student info', async () => {
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
      await this.com.addStudent(alice, '1,alice,a', { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');

      (await this.com.studentInfo(alice)).toString().should.eq('1,alice,a');

      // ================================================================

      await this.com.updateStudentInfo(alice, 'aaa,bbb,ccc,ddd,eee', {
        from: owner,
      });

      (await this.com.studentInfo(alice))
        .toString()
        .should.eq('aaa,bbb,ccc,ddd,eee');

      // ================================================================

      await shouldFail.reverting(
        this.com.updateStudentInfo(alice, 'thanos', {
          from: alice,
        }),
      );
    });
    it('Can not add twice', async () => {
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
      await this.com.addStudent(alice, '1,alice,a', { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');

      await shouldFail.reverting(
        this.com.addStudent(alice, '1,alice,a', { from: owner }),
      );
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');
    });
    it('Only owner can remove student', async () => {
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(alice, '1,alice,a', { from: owner });
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');
      (await this.com.studentWhitelist(bob)).toString().should.eq('true');

      await this.com.removeStudent(alice, { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');

      // ================================================================

      await shouldFail.reverting(this.com.removeStudent(bob, { from: alice }));
      await shouldFail.reverting(this.com.removeStudent(bob, { from: bob }));
      await shouldFail.reverting(this.com.removeStudent(bob, { from: carol }));
      (await this.com.studentWhitelist(bob)).toString().should.eq('true');
    });
    it('Can not remove twice', async () => {
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
      await this.com.addStudent(alice, '1,alice,a', { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');

      await this.com.removeStudent(alice, { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');

      await shouldFail.reverting(
        this.com.removeStudent(alice, { from: owner }),
      );
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
    });
    it('Can not update info if a student has been removed', async () => {
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');
      await this.com.addStudent(alice, '1,alice,a', { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('true');

      // ================================================================

      await this.com.updateStudentInfo(alice, 'aaa,bbb,ccc,ddd,eee', {
        from: owner,
      });

      (await this.com.studentInfo(alice))
        .toString()
        .should.eq('aaa,bbb,ccc,ddd,eee');

      // ================================================================

      await this.com.removeStudent(alice, { from: owner });
      (await this.com.studentWhitelist(alice)).toString().should.eq('false');

      await shouldFail.reverting(
        this.com.updateStudentInfo(alice, 'DASDASDASDASD', {
          from: owner,
        }),
      );
    });
    it('Only owner can setStudentIncentive', async () => {
      (await this.com.studentIncentive()).toString().should.eq('1');
      await this.com.setStudentIncentive(10, { from: owner });
      (await this.com.studentIncentive()).toString().should.eq('10');

      // ================================================================

      (await this.com.studentIncentive()).toString().should.eq('10');
      await shouldFail.reverting(
        this.com.setStudentIncentive(20, { from: alice }),
      );
      await shouldFail.reverting(
        this.com.setStudentIncentive(30, { from: bob }),
      );
      await shouldFail.reverting(
        this.com.setStudentIncentive(40, { from: carol }),
      );
      (await this.com.studentIncentive()).toString().should.eq('10');
    });
    it('Only owner can setSchoolIncentive', async () => {
      (await this.com.schoolIncentive()).toString().should.eq('1');
      await this.com.setSchoolIncentive(10, { from: owner });
      (await this.com.schoolIncentive()).toString().should.eq('10');

      // ================================================================

      (await this.com.schoolIncentive()).toString().should.eq('10');
      await shouldFail.reverting(
        this.com.setSchoolIncentive(20, { from: alice }),
      );
      await shouldFail.reverting(
        this.com.setSchoolIncentive(30, { from: bob }),
      );
      await shouldFail.reverting(
        this.com.setSchoolIncentive(40, { from: carol }),
      );
      (await this.com.schoolIncentive()).toString().should.eq('10');
    });
    it('Only owner should be able to deposit', async () => {
      (await this.com.getTokenBalance()).toString().should.eq('0');
      await this.com.deposit(50, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('50');

      await shouldFail.reverting(this.com.deposit(100, { from: owner }));
      await this.dai.mint(owner, 10000, { from: owner });
      await this.com.deposit(100, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('150');

      await shouldFail.reverting(this.com.deposit(2000, { from: owner }));
      await this.dai.approve(this.com.address, 5000, { from: owner });
      await this.com.deposit(2000, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('2150');

      // ================================================================

      (await this.dai.balanceOf(alice)).toString().should.eq('0');
      await this.dai.mint(alice, 100, { from: owner });
      (await this.dai.balanceOf(alice)).toString().should.eq('100');
      await this.dai.approve(this.com.address, 1000, { from: alice });
      await shouldFail.reverting(this.com.deposit(20, { from: alice }));
    });
    it('Only owner should be able to withdraw', async () => {
      (await this.com.getTokenBalance()).toString().should.eq('0');
      await shouldFail.reverting(this.com.withdraw(1, { from: owner }));
      await this.com.deposit(50, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('50');

      await this.com.withdraw(25, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('25');
      await shouldFail.reverting(this.com.withdraw(30, { from: owner }));
      await shouldFail.reverting(this.com.withdraw(1, { from: alice }));
      await shouldFail.reverting(this.com.withdraw(1, { from: bob }));
      await shouldFail.reverting(this.com.withdraw(1, { from: carol }));

      await this.com.withdraw(25, { from: owner });
      (await this.com.getTokenBalance()).toString().should.eq('0');
    });
    it('check ecrecover', async () => {
      (await this.com.recoverStudentAddressFromSignature(
        20,
        await signTime(20, owner),
      ))
        .toString()
        .should.eq(owner);
      (await this.com.recoverStudentAddressFromSignature(
        35,
        await signTime(35, alice),
      ))
        .toString()
        .should.eq(alice);
      (await this.com.recoverStudentAddressFromSignature(
        999,
        await signTime(999, bob),
      ))
        .toString()
        .should.eq(bob);
      (await this.com.recoverStudentAddressFromSignature(
        9358639819113,
        await signTime(9358639819113, carol),
      ))
        .toString()
        .should.eq(carol);
    });
    it('check claimReward, scenario 1, student not in whitelist, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      // await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 2, school does not have identity, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      // await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 3, school not enough in Company contract, should fail', async () => {
      // await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 4, timestamp is too old, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now() - 11 * 60;
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 5, timestamp can not be future, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now() + 60;
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 6, sender is not school, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: bob }),
      );
    });
    it('check claimReward, scenario 7, student signature is wrong, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const fakeBobSig = await signTime(now, alice);
      (await this.com.recoverStudentAddressFromSignature(now, fakeBobSig))
        .toString()
        .should.eq(alice);

      await shouldFail.reverting(
        this.com.claimReward(now, fakeBobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 8, should success', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await this.com.claimReward(now, bobSig, { from: alice });

      (await this.com.getTokenBalance()).toString().should.eq('48');
      (await this.dai.balanceOf(alice)).toString().should.eq('1');
      (await this.dai.balanceOf(bob)).toString().should.eq('1');
    });
    it('check claimReward, scenario 9, with difference incentive, should success', async () => {
      await this.com.setStudentIncentive(17, { from: owner });
      await this.com.setSchoolIncentive(8, { from: owner });

      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await this.com.claimReward(now, bobSig, { from: alice });

      (await this.com.getTokenBalance()).toString().should.eq('25');
      (await this.dai.balanceOf(alice)).toString().should.eq('8');
      (await this.dai.balanceOf(bob)).toString().should.eq('17');
    });
    it('check claimReward, scenario 10, owner can reset recentClaim of a student, should success', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await this.com.claimReward(now, bobSig, { from: alice });

      (await this.com.getTokenBalance()).toString().should.eq('48');
      (await this.dai.balanceOf(alice)).toString().should.eq('1');
      (await this.dai.balanceOf(bob)).toString().should.eq('1');

      (await this.com.getTokenBalance()).toString().should.eq('48');
      (await this.dai.balanceOf(alice)).toString().should.eq('1');
      (await this.dai.balanceOf(bob)).toString().should.eq('1');

      // ================================================================

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );

      await this.com.resetClaim(bob, { from: owner });

      await this.com.claimReward(now, bobSig, { from: alice });

      (await this.com.getTokenBalance()).toString().should.eq('46');
      (await this.dai.balanceOf(alice)).toString().should.eq('2');
      (await this.dai.balanceOf(bob)).toString().should.eq('2');
    });
    it('check claimReward, scenario 11, only owner can reset recentClaim, should fail', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      const now = _now();
      const bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);
      await this.com.claimReward(now, bobSig, { from: alice });
      (await this.com.getTokenBalance()).toString().should.eq('48');
      (await this.dai.balanceOf(alice)).toString().should.eq('1');
      (await this.dai.balanceOf(bob)).toString().should.eq('1');
      // ================================================================
      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
      await shouldFail.reverting(this.com.resetClaim(bob, { from: alice }));
      await shouldFail.reverting(this.com.resetClaim(bob, { from: bob }));
      await shouldFail.reverting(this.com.resetClaim(bob, { from: carol }));
      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );
    });
    it('check claimReward, scenario 12, should wait for a day to claim again, should success', async () => {
      await this.com.deposit(50, { from: owner });
      await this.mip.addMe({ from: alice });
      (await this.com.studentWhitelist(bob)).toString().should.eq('false');
      await this.com.addStudent(bob, '2,bob,b', { from: owner });
      let now = _now();
      let bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await this.com.claimReward(now, bobSig, { from: alice });

      (await this.com.getTokenBalance()).toString().should.eq('48');
      (await this.dai.balanceOf(alice)).toString().should.eq('1');
      (await this.dai.balanceOf(bob)).toString().should.eq('1');

      // ================================================================

      await time.increase(time.duration.hours(1));

      now = now + 3600;
      bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await shouldFail.reverting(
        this.com.claimReward(now, bobSig, { from: alice }),
      );

      // ================================================================

      await time.increase(time.duration.days(1));

      now = now + 86400;
      bobSig = await signTime(now, bob);
      (await this.com.recoverStudentAddressFromSignature(now, bobSig))
        .toString()
        .should.eq(bob);

      await this.com.claimReward(now, bobSig, { from: alice });

      (await this.com.getTokenBalance()).toString().should.eq('46');
      (await this.dai.balanceOf(alice)).toString().should.eq('2');
      (await this.dai.balanceOf(bob)).toString().should.eq('2');
    });
  });
});
