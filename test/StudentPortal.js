const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StudentPortal", function () {
  let StudentPortal;
  let studentPortal;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    StudentPortal = await ethers.getContractFactory("StudentPortal");
    [owner, addr1, addr2] = await ethers.getSigners();
    studentPortal = await StudentPortal.deploy();
    await studentPortal.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await studentPortal.owner()).to.equal(owner.address);
    });

    it("Should start with zero students", async function () {
      expect(await studentPortal.getStudentCount()).to.equal(0);
    });
  });

  describe("Student Registration", function () {
    it("Should allow owner to register a student", async function () {
      await studentPortal.registerStudent("Alice", "alice@example.com", 946684800, "LGA1", "Country1", "State1");
      expect(await studentPortal.getStudentCount()).to.equal(1);
    });

    it("Should emit StudentRegistered event", async function () {
      await expect(studentPortal.registerStudent("Bob", "bob@example.com", 946684800, "LGA2", "Country2", "State2"))
        .to.emit(studentPortal, "StudentRegistered")
        .withArgs(1);
    });

    it("Should not allow non-owner to register a student", async function () {
      await expect(
        studentPortal.connect(addr1).registerStudent("Charlie", "charlie@example.com", 946684800, "LGA3", "Country3", "State3")
      ).to.be.revertedWith("Only the owner can perform this action");
    });
  });

  describe("Student Retrieval", function () {
    beforeEach(async function () {
      await studentPortal.registerStudent("Alice", "alice@example.com", 946684800, "LGA1", "Country1", "State1");
    });

    it("Should return correct student details", async function () {
      const student = await studentPortal.getStudent(1);
      expect(student.name).to.equal("Alice");
      expect(student.email).to.equal("alice@example.com");
      expect(student.dateOfBirth).to.equal(946684800);
      expect(student.localGovernmentArea).to.equal("LGA1");
      expect(student.country).to.equal("Country1");
      expect(student.state).to.equal("State1");
    });

    it("Should revert when querying non-existent student", async function () {
      await expect(studentPortal.getStudent(2)).to.be.revertedWith("Invalid student ID");
    });

    it("Should return all students", async function () {
      await studentPortal.registerStudent("Bob", "bob@example.com", 946684800, "LGA2", "Country2", "State2");
      const students = await studentPortal.getAllStudents();
      expect(students.length).to.equal(2);
      expect(students[0].name).to.equal("Alice");
      expect(students[1].name).to.equal("Bob");
    });
  });

  describe("Student Update", function () {
    beforeEach(async function () {
      await studentPortal.registerStudent("Alice", "alice@example.com", 946684800, "LGA1", "Country1", "State1");
    });

    it("Should allow owner to update a student", async function () {
      await studentPortal.updateStudent(1, "Alice Updated", "alice.updated@example.com", 978307200, "LGA1 Updated", "Country1 Updated", "State1 Updated");
      const student = await studentPortal.getStudent(1);
      expect(student.name).to.equal("Alice Updated");
      expect(student.email).to.equal("alice.updated@example.com");
    });

    it("Should emit StudentUpdated event", async function () {
      await expect(studentPortal.updateStudent(1, "Alice Updated", "alice.updated@example.com", 978307200, "LGA1 Updated", "Country1 Updated", "State1 Updated"))
        .to.emit(studentPortal, "StudentUpdated")
        .withArgs(1);
    });

    it("Should not allow non-owner to update a student", async function () {
      await expect(
        studentPortal.connect(addr1).updateStudent(1, "Alice Updated", "alice.updated@example.com", 978307200, "LGA1 Updated", "Country1 Updated", "State1 Updated")
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should revert when updating non-existent student", async function () {
      await expect(
        studentPortal.updateStudent(2, "Non-existent", "non-existent@example.com", 978307200, "LGA", "Country", "State")
      ).to.be.revertedWith("Invalid student ID");
    });
  });

  describe("Student Deletion", function () {
    beforeEach(async function () {
      await studentPortal.registerStudent("Alice", "alice@example.com", 946684800, "LGA1", "Country1", "State1");
    });

    it("Should allow owner to delete a student", async function () {
      await studentPortal.deleteStudent(1);
      await expect(studentPortal.getStudent(1)).to.be.revertedWith("Student not found");
    });

    it("Should emit StudentDeleted event", async function () {
      await expect(studentPortal.deleteStudent(1))
        .to.emit(studentPortal, "StudentDeleted")
        .withArgs(1);
    });

    it("Should not allow non-owner to delete a student", async function () {
      await expect(
        studentPortal.connect(addr1).deleteStudent(1)
      ).to.be.revertedWith("Only the owner can perform this action");
    });

    it("Should not allow deleting an already deleted student", async function () {
      await studentPortal.deleteStudent(1);
      await expect(studentPortal.deleteStudent(1)).to.be.revertedWith("Student already deleted");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum number of students", async function () {
      for (let i = 0; i < 100; i++) {
        await studentPortal.registerStudent(`Student${i}`, `student${i}@example.com`, 946684800, "LGA", "Country", "State");
      }
      expect(await studentPortal.getStudentCount()).to.equal(100);
    });

    it("Should handle deleting all students", async function () {
      await studentPortal.registerStudent("Alice", "alice@example.com", 946684800, "LGA1", "Country1", "State1");
      await studentPortal.registerStudent("Bob", "bob@example.com", 946684800, "LGA2", "Country2", "State2");
      
      await studentPortal.deleteStudent(1);
      await studentPortal.deleteStudent(2);
      
      expect(await studentPortal.getStudentCount()).to.equal(2); 
      const students = await studentPortal.getAllStudents();
      expect(students.length).to.equal(2);
      expect(students[0].name).to.equal(""); 
      expect(students[1].name).to.equal("");
    });

    it("Should handle updating a deleted student", async function () {
      await studentPortal.registerStudent("Alice", "alice@example.com", 946684800, "LGA1", "Country1", "State1");
      await studentPortal.deleteStudent(1);
      
      await studentPortal.updateStudent(1, "Alice Restored", "alice.restored@example.com", 978307200, "LGA1 Restored", "Country1 Restored", "State1 Restored");
      
      const student = await studentPortal.getStudent(1);
      expect(student.name).to.equal("Alice Restored");
    });

    it("Should handle large date of birth values", async function () {
      const farFuture = BigInt(2) ** BigInt(255) - BigInt(1);
      
      await studentPortal.registerStudent(
        "Future Student",
        "future@example.com",
        farFuture.toString(),
        "LGA",
        "Country",
        "State"
      );
      
      const student = await studentPortal.getStudent(1);
      expect(student.dateOfBirth.toString()).to.equal(farFuture.toString());
    });
  });
});