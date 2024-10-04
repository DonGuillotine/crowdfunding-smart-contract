// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract StudentPortal {
    struct Student {
        string name;
        string email;
        uint256 dateOfBirth;
        string localGovernmentArea;
        string country;
        string state;
    }

    address public owner;
    mapping(uint256 => Student) private students;
    uint256 private studentCount;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    event StudentRegistered(uint256 indexed studentId);
    event StudentUpdated(uint256 indexed studentId);
    event StudentDeleted(uint256 indexed studentId);

    function registerStudent(
        string memory _name,
        string memory _email,
        uint256 _dateOfBirth,
        string memory _localGovernmentArea,
        string memory _country,
        string memory _state
    ) external onlyOwner {
        studentCount++;
        students[studentCount] = Student({
            name: _name,
            email: _email,
            dateOfBirth: _dateOfBirth,
            localGovernmentArea: _localGovernmentArea,
            country: _country,
            state: _state
        });

        emit StudentRegistered(studentCount);
    }

    function updateStudent(
        uint256 _studentId,
        string memory _name,
        string memory _email,
        uint256 _dateOfBirth,
        string memory _localGovernmentArea,
        string memory _country,
        string memory _state
    ) external onlyOwner {
        require(_studentId > 0 && _studentId <= studentCount, "Invalid student ID");

        Student storage student = students[_studentId];
        student.name = _name;
        student.email = _email;
        student.dateOfBirth = _dateOfBirth;
        student.localGovernmentArea = _localGovernmentArea;
        student.country = _country;
        student.state = _state;

        emit StudentUpdated(_studentId);
    }

    function deleteStudent(uint256 _studentId) external onlyOwner {
        require(_studentId > 0 && _studentId <= studentCount, "Invalid student ID");
        require(bytes(students[_studentId].name).length > 0, "Student already deleted");
        delete students[_studentId];
        emit StudentDeleted(_studentId);
    }

    function getStudent(uint256 _studentId) external view returns (Student memory) {
        require(_studentId > 0 && _studentId <= studentCount, "Invalid student ID");
        require(bytes(students[_studentId].name).length > 0, "Student not found");
        return students[_studentId];
    }

    function getStudentCount() external view returns (uint256) {
        return studentCount;
    }

    function getAllStudents() external view returns (Student[] memory) {
        Student[] memory allStudents = new Student[](studentCount);
        for (uint256 i = 1; i <= studentCount; i++) {
            allStudents[i - 1] = students[i];
        }
        return allStudents;
    }
}