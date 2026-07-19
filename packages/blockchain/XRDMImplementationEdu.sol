// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./XRDM.sol";

contract XRDMImplementation is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    XRDM public xrdmToken;
    address public admin;

    mapping(bytes32 => address) public collegeAdmins;
    mapping(address => bytes32) public adminCollege;
    mapping(address => bytes32) public teacherCollege;
    mapping(bytes32 => bool) public validColleges;

    enum AssignmentType {
        Class,
        Section,
        Group
    }

    enum AssignmentStatus {
        Active,
        Completed,
        Cancelled
    }

    enum SubmissionStatus {
        Pending,
        Approved,
        Rejected
    }

    struct Assignment {
        uint256 assignmentId;
        address teacher;
        string description;
        uint256 tokenReward;
        uint64 deadline;
        AssignmentType assignmentType;
        bytes32 classHash;
        bytes32 sectionHash;
        bytes32 collegeId;
        address[] selectedStudents;
        AssignmentStatus status;
        uint256 createdAt;
    }

    struct Submission {
        uint256 submissionId;
        uint256 assignmentId;
        address student;
        bytes32 photoHash;
        uint64 submittedAt;
        SubmissionStatus status;
        address approvedBy;
        uint64 approvedAt;
        string rejectionReason;
    }

    mapping(uint256 => Assignment) internal assignments;
    mapping(uint256 => Submission) internal submissions;
    mapping(address => bool) public isTeacher;
    mapping(address => uint256[]) internal studentAssignments;
    mapping(uint256 => address[]) internal assignmentStudents;
    mapping(uint256 => uint256[]) internal assignmentSubmissions;
    mapping(address => uint256[]) internal teacherAssignments;
    mapping(uint256 => mapping(address => bool)) internal hasSubmitted;
    mapping(uint256 => mapping(address => bool)) internal isAssigned;

    uint256 public nextAssignmentId;
    uint256 public nextSubmissionId;

    uint256 public constant MAX_BATCH_SIZE = 100;

    // ─── Hackathon feature ─────────────────────────────────────────
    struct Hackathon {
        address host;
        mapping(address => bool) isParticipant;
        mapping(address => bool) isWinner;
        mapping(address => uint256) xrdmAwarded;
        uint256 nftCounter;
    }

    mapping(address => bool) public isApprovedHost;
    uint256 public maxXRDMPerParticipant;
    uint256 public nextHackathonId;
    mapping(uint256 => Hackathon) internal hackathons;

    event TeacherAdded(address indexed teacher, bytes32 indexed collegeId);
    event TeacherRemoved(address indexed teacher);
    event AssignmentCreated(
        uint256 indexed assignmentId,
        address indexed teacher,
        string description,
        uint256 tokenReward,
        uint64 deadline,
        AssignmentType assignmentType,
        bytes32 classHash,
        bytes32 sectionHash,
        bytes32 indexed collegeId,
        address[] selectedStudents
    );
    event AssignmentCancelled(
        uint256 indexed assignmentId,
        address indexed teacher
    );
    event AssignmentCompleted(uint256 indexed assignmentId);
    event AssignmentDeadlineExtended(
        uint256 indexed assignmentId,
        address indexed teacher,
        uint64 oldDeadline,
        uint64 newDeadline
    );
    event SubmissionCreated(
        uint256 indexed submissionId,
        uint256 indexed assignmentId,
        address indexed student,
        bytes32 photoHash
    );
    event SubmissionApproved(
        uint256 indexed submissionId,
        uint256 indexed assignmentId,
        address indexed student,
        address approvedBy,
        uint256 tokenId,
        uint256 tokenAmount,
        bytes32 collegeId
    );
    event SubmissionRejected(
        uint256 indexed submissionId,
        uint256 indexed assignmentId,
        address indexed student,
        address rejectedBy,
        string reason
    );
    event SoulboundTokenContractSet(
        address indexed oldContract,
        address indexed newContract
    );
    event AdminSet(address indexed oldAdmin, address indexed newAdmin);
    event CollegeAdminSet(
        bytes32 indexed collegeId,
        address indexed oldAdmin,
        address indexed newAdmin
    );
    event ValidCollegeSet(bytes32 indexed collegeId, bool valid);

    // ─── Hackathon events ──────────────────────────────────────────
    event HackathonCreated(uint256 indexed hackathonId, address indexed host);
    event ParticipantsRegistered(uint256 indexed hackathonId, address[] participants);
    event XRDMAwarded(uint256 indexed hackathonId, address indexed recipient, uint256 amount, uint256 tokenId);
    event WinnersNoted(uint256 indexed hackathonId, address[] winners);
    event NFTAwarded(uint256 indexed hackathonId, address indexed recipient, uint256 indexed tokenId, string uri);
    event ApprovedHostAdded(address indexed host);
    event ApprovedHostRemoved(address indexed host);
    event MaxXRDMPerParticipantUpdated(uint256 oldValue, uint256 newValue);

    error NotTeacher();
    error AssignmentNotFound();
    error SubmissionNotFound();
    error NotAssigned();
    error DeadlinePassed();
    error AssignmentNotActive();
    error InvalidAddress();
    error InvalidTokenReward();
    error InvalidDeadline();
    error BatchTooLarge();
    error EmptyArray();
    error SubmissionNotPending();
    error InvalidPhotoHash();
    error DuplicateStudent();
    error AssignmentIsCancelled();
    error NotAdmin();
    error TokenMintingFailed();
    error AlreadyTeacher();
    error NotATeacher();
    error AlreadyApproved();
    error InvalidCollegeId();
    error CollegeNotFound();
    error TeacherNotInCollege();
    error DifferentCollege();
    error AddressAlreadyAdmin();
    error CannotShortenDeadline();

    // ─── Hackathon errors ──────────────────────────────────────────
    error NotApprovedHost();
    error HackathonNotFound();
    error NotHackathonHost();
    error NotAParticipant();
    error ExceedsPerParticipantCap();
    error ArrayLengthMismatch();
    error InvalidAmount();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _soulboundToken,
        address _owner
    ) public initializer {
        if (_soulboundToken == address(0)) revert InvalidAddress();
        if (_owner == address(0)) revert InvalidAddress();
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        xrdmToken = XRDM(_soulboundToken);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    modifier onlyAdminOrOwnerIfNoAdmin() {
        if (admin != address(0)) {
            if (msg.sender != admin) revert NotAdmin();
        } else {
            _checkOwner();
        }
        _;
    }

    modifier onlyAdminOrOwner() {
        if (admin != address(0)) {
            if (msg.sender != admin && msg.sender != owner()) revert NotAdmin();
        } else {
            _checkOwner();
        }
        _;
    }

    modifier onlyCollegeAdmin(bytes32 collegeId) {
        if (collegeAdmins[collegeId] != address(0)) {
            if (collegeAdmins[collegeId] != msg.sender && msg.sender != owner())
                revert NotAdmin();
        } else {
            _checkOwner();
        }
        _;
    }

    function setAdmin(address _admin) external onlyOwner {
        if (_admin == address(0)) revert InvalidAddress();
        address oldAdmin = admin;
        admin = _admin;
        emit AdminSet(oldAdmin, _admin);
    }

    function setSoulboundTokenContract(
        address _soulboundToken
    ) external onlyOwner {
        if (_soulboundToken == address(0)) revert InvalidAddress();
        address oldContract = address(xrdmToken);
        xrdmToken = XRDM(_soulboundToken);
        emit SoulboundTokenContractSet(oldContract, _soulboundToken);
    }

    function setCollegeAdmin(
        bytes32 collegeId,
        address adminAddress
    ) external onlyAdminOrOwner {
        if (collegeId == bytes32(0)) revert InvalidCollegeId();
        if (adminAddress == address(0)) revert InvalidAddress();

        bytes32 existingCollege = adminCollege[adminAddress];
        if (existingCollege != bytes32(0) && existingCollege != collegeId) {
            revert AddressAlreadyAdmin();
        }

        address oldAdmin = collegeAdmins[collegeId];

        if (oldAdmin != address(0) && oldAdmin != adminAddress) {
            adminCollege[oldAdmin] = bytes32(0);
        }

        collegeAdmins[collegeId] = adminAddress;
        adminCollege[adminAddress] = collegeId;

        emit CollegeAdminSet(collegeId, oldAdmin, adminAddress);
    }

    function setValidCollege(bytes32 collegeId, bool valid) external onlyAdminOrOwner {
        if (collegeId == bytes32(0)) revert InvalidCollegeId();
        validColleges[collegeId] = valid;
        emit ValidCollegeSet(collegeId, valid);
    }

    function addTeacher(
        address teacher,
        bytes32 collegeId
    ) external onlyAdminOrOwnerIfNoAdmin {
        if (teacher == address(0)) revert InvalidAddress();
        if (isTeacher[teacher]) revert AlreadyTeacher();
        if (collegeId != bytes32(0) && !validColleges[collegeId])
            revert CollegeNotFound();

        isTeacher[teacher] = true;
        teacherCollege[teacher] = collegeId;

        emit TeacherAdded(teacher, collegeId);
    }

    function removeTeacher(address teacher) external onlyAdminOrOwnerIfNoAdmin {
        if (teacher == address(0)) revert InvalidAddress();
        if (!isTeacher[teacher]) revert NotATeacher();

        isTeacher[teacher] = false;
        teacherCollege[teacher] = bytes32(0);

        emit TeacherRemoved(teacher);
    }

    function createAssignment(
        string calldata description,
        uint256 tokenReward,
        uint64 deadline,
        AssignmentType assignmentType,
        bytes32 classHash,
        bytes32 sectionHash,
        bytes32 collegeId,
        address[] calldata selectedStudents
    ) external nonReentrant returns (uint256 assignmentId) {
        if (!isTeacher[msg.sender]) revert NotTeacher();
        if (tokenReward == 0) revert InvalidTokenReward();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (collegeId == bytes32(0)) revert InvalidCollegeId();
        if (!validColleges[collegeId]) revert CollegeNotFound();
        if (teacherCollege[msg.sender] != collegeId)
            revert TeacherNotInCollege();
        if (assignmentType == AssignmentType.Group) {
            if (selectedStudents.length == 0) revert EmptyArray();
            if (selectedStudents.length > MAX_BATCH_SIZE)
                revert BatchTooLarge();
        }

        assignmentId = ++nextAssignmentId;

        Assignment storage assignment = assignments[assignmentId];
        assignment.assignmentId = assignmentId;
        assignment.teacher = msg.sender;
        assignment.description = description;
        assignment.tokenReward = tokenReward;
        assignment.deadline = deadline;
        assignment.assignmentType = assignmentType;
        assignment.classHash = classHash;
        assignment.sectionHash = sectionHash;
        assignment.collegeId = collegeId;
        assignment.status = AssignmentStatus.Active;
        assignment.createdAt = block.timestamp;

        if (assignmentType == AssignmentType.Group) {
            for (uint256 i = 0; i < selectedStudents.length; i++) {
                if (selectedStudents[i] == address(0)) revert InvalidAddress();

                if (isAssigned[assignmentId][selectedStudents[i]]) {
                    revert DuplicateStudent();
                }

                assignment.selectedStudents.push(selectedStudents[i]);
                isAssigned[assignmentId][selectedStudents[i]] = true;
                studentAssignments[selectedStudents[i]].push(assignmentId);
                assignmentStudents[assignmentId].push(selectedStudents[i]);
            }
        }

        teacherAssignments[msg.sender].push(assignmentId);

        emit AssignmentCreated(
            assignmentId,
            msg.sender,
            description,
            tokenReward,
            deadline,
            assignmentType,
            classHash,
            sectionHash,
            collegeId,
            assignment.selectedStudents
        );

        return assignmentId;
    }

    function extendAssignmentDeadline(
        uint256 assignmentId,
        uint64 newDeadline
    ) external nonReentrant {
        Assignment storage assignment = assignments[assignmentId];
        if (assignment.teacher == address(0)) revert AssignmentNotFound();
        if (assignment.teacher != msg.sender) revert NotTeacher();
        if (teacherCollege[msg.sender] != assignment.collegeId)
            revert DifferentCollege();

        if (newDeadline <= assignment.deadline) revert CannotShortenDeadline();
        if (newDeadline <= block.timestamp) revert InvalidDeadline();

        uint64 oldDeadline = assignment.deadline;
        assignment.deadline = newDeadline;

        if (assignment.status == AssignmentStatus.Completed) {
            assignment.status = AssignmentStatus.Active;
        }

        emit AssignmentDeadlineExtended(assignmentId, msg.sender, oldDeadline, newDeadline);
    }

    function assignStudents(
        uint256 assignmentId,
        address[] calldata students
    ) external nonReentrant {
        Assignment storage assignment = assignments[assignmentId];
        if (assignment.teacher == address(0)) revert AssignmentNotFound();
        if (assignment.teacher != msg.sender && !isTeacher[msg.sender])
            revert NotTeacher();
        if (teacherCollege[msg.sender] != assignment.collegeId)
            revert DifferentCollege();

        _checkAndCompleteAssignment(assignmentId);

        AssignmentStatus actualStatus = _getActualStatus(assignment);
        if (actualStatus == AssignmentStatus.Cancelled)
            revert AssignmentIsCancelled();
        if (actualStatus != AssignmentStatus.Active)
            revert AssignmentNotActive();

        if (students.length == 0) revert EmptyArray();
        if (students.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        for (uint256 i = 0; i < students.length; i++) {
            if (students[i] == address(0)) revert InvalidAddress();
            if (!isAssigned[assignmentId][students[i]]) {
                isAssigned[assignmentId][students[i]] = true;
                studentAssignments[students[i]].push(assignmentId);
                assignmentStudents[assignmentId].push(students[i]);
            }
        }
    }

    function submitAssignment(
        uint256 assignmentId,
        bytes32 photoHash
    ) external nonReentrant returns (uint256 submissionId) {
        Assignment storage assignment = assignments[assignmentId];
        if (assignment.teacher == address(0)) revert AssignmentNotFound();
        if (!isAssigned[assignmentId][msg.sender]) revert NotAssigned();
        if (block.timestamp > assignment.deadline) revert DeadlinePassed();
        if (photoHash == bytes32(0)) revert InvalidPhotoHash();

        _checkAndCompleteAssignment(assignmentId);

        AssignmentStatus actualStatus = _getActualStatus(assignment);
        if (actualStatus == AssignmentStatus.Cancelled)
            revert AssignmentIsCancelled();
        if (actualStatus != AssignmentStatus.Active)
            revert AssignmentNotActive();

        if (_hasApprovedSubmission(assignmentId, msg.sender))
            revert AlreadyApproved();

        submissionId = ++nextSubmissionId;

        Submission storage submission = submissions[submissionId];
        submission.submissionId = submissionId;
        submission.assignmentId = assignmentId;
        submission.student = msg.sender;
        submission.photoHash = photoHash;
        submission.submittedAt = uint64(block.timestamp);
        submission.status = SubmissionStatus.Pending;

        if (!hasSubmitted[assignmentId][msg.sender]) {
            hasSubmitted[assignmentId][msg.sender] = true;
        }
        assignmentSubmissions[assignmentId].push(submissionId);

        emit SubmissionCreated(
            submissionId,
            assignmentId,
            msg.sender,
            photoHash
        );

        return submissionId;
    }

    function approveSubmission(uint256 submissionId) external nonReentrant {
        Submission storage submission = submissions[submissionId];
        if (submission.student == address(0)) revert SubmissionNotFound();

        Assignment storage assignment = assignments[submission.assignmentId];
        if (assignment.teacher != msg.sender && !isTeacher[msg.sender])
            revert NotTeacher();
        if (teacherCollege[msg.sender] != assignment.collegeId)
            revert DifferentCollege();
        if (submission.status != SubmissionStatus.Pending)
            revert SubmissionNotPending();

        _checkAndCompleteAssignment(submission.assignmentId);

        // Hash-based tokenId — O(1), no cap, no linear search
        // "EDU_ASSIGN" salt prevents collision with any other tokenId scheme (e.g. Corporate team NFT)
        uint256 tokenId = uint256(keccak256(abi.encodePacked(submission.assignmentId, submission.student, "EDU_ASSIGN")));

        try
            xrdmToken.mintSoulboundToken(
                submission.student,
                tokenId,
                assignment.tokenReward,
                submission.assignmentId
            )
        {
            submission.status = SubmissionStatus.Approved;
            submission.approvedBy = msg.sender;
            submission.approvedAt = uint64(block.timestamp);

            emit SubmissionApproved(
                submissionId,
                submission.assignmentId,
                submission.student,
                msg.sender,
                tokenId,
                assignment.tokenReward,
                assignment.collegeId
            );
        } catch {
            revert TokenMintingFailed();
        }
    }

    function rejectSubmission(
        uint256 submissionId,
        string calldata reason
    ) external nonReentrant {
        Submission storage submission = submissions[submissionId];
        if (submission.student == address(0)) revert SubmissionNotFound();

        Assignment storage assignment = assignments[submission.assignmentId];
        if (assignment.teacher != msg.sender && !isTeacher[msg.sender])
            revert NotTeacher();

        if (teacherCollege[msg.sender] != assignment.collegeId)
            revert DifferentCollege();

        if (submission.status != SubmissionStatus.Pending)
            revert SubmissionNotPending();

        _checkAndCompleteAssignment(submission.assignmentId);

        submission.status = SubmissionStatus.Rejected;
        submission.approvedBy = msg.sender;
        submission.approvedAt = uint64(block.timestamp);
        submission.rejectionReason = reason;

        emit SubmissionRejected(
            submissionId,
            submission.assignmentId,
            submission.student,
            msg.sender,
            reason
        );
    }

    function _getActualStatus(
        Assignment storage assignment
    ) internal view returns (AssignmentStatus) {
        if (assignment.status == AssignmentStatus.Cancelled) {
            return AssignmentStatus.Cancelled;
        }
        if (block.timestamp > assignment.deadline) {
            return AssignmentStatus.Completed;
        }
        return AssignmentStatus.Active;
    }

    function _checkAndCompleteAssignment(uint256 assignmentId) internal {
        Assignment storage assignment = assignments[assignmentId];
        if (
            assignment.status == AssignmentStatus.Active &&
            block.timestamp > assignment.deadline
        ) {
            assignment.status = AssignmentStatus.Completed;
            emit AssignmentCompleted(assignmentId);
        }
    }

    function cancelAssignment(uint256 assignmentId) external nonReentrant {
        Assignment storage assignment = assignments[assignmentId];
        if (assignment.teacher == address(0)) revert AssignmentNotFound();
        if (assignment.teacher != msg.sender && !isTeacher[msg.sender])
            revert NotTeacher();

        if (assignment.teacher != msg.sender) {
            if (
                teacherCollege[msg.sender] != assignment.collegeId &&
                collegeAdmins[assignment.collegeId] != msg.sender
            ) {
                revert DifferentCollege();
            }
        }

        if (assignment.status != AssignmentStatus.Active)
            revert AssignmentNotActive();

        assignment.status = AssignmentStatus.Cancelled;

        emit AssignmentCancelled(assignmentId, msg.sender);
    }

    function _hasApprovedSubmission(
        uint256 assignmentId,
        address student
    ) internal view returns (bool) {
        uint256[] memory submissionIds = assignmentSubmissions[assignmentId];
        for (uint256 i = 0; i < submissionIds.length; i++) {
            Submission storage sub = submissions[submissionIds[i]];
            if (
                sub.student == student &&
                sub.status == SubmissionStatus.Approved
            ) {
                return true;
            }
        }
        return false;
    }

    function getAssignment(
        uint256 assignmentId
    )
        external
        view
        returns (
            uint256 _assignmentId,
            address teacher,
            string memory description,
            uint256 tokenReward,
            uint64 deadline,
            AssignmentType assignmentType,
            bytes32 classHash,
            bytes32 sectionHash,
            bytes32 collegeId,
            address[] memory selectedStudents,
            AssignmentStatus status,
            uint256 createdAt
        )
    {
        Assignment storage assignment = assignments[assignmentId];
        if (assignment.teacher == address(0)) revert AssignmentNotFound();

        AssignmentStatus actualStatus = _getActualStatus(assignment);

        return (
            assignment.assignmentId,
            assignment.teacher,
            assignment.description,
            assignment.tokenReward,
            assignment.deadline,
            assignment.assignmentType,
            assignment.classHash,
            assignment.sectionHash,
            assignment.collegeId,
            assignment.selectedStudents,
            actualStatus,
            assignment.createdAt
        );
    }

    function getSubmission(
        uint256 submissionId
    )
        external
        view
        returns (
            uint256 _submissionId,
            uint256 assignmentId,
            address student,
            bytes32 photoHash,
            uint64 submittedAt,
            SubmissionStatus status,
            address approvedBy,
            uint64 approvedAt,
            string memory rejectionReason
        )
    {
        Submission storage submission = submissions[submissionId];
        if (submission.student == address(0)) revert SubmissionNotFound();
        return (
            submission.submissionId,
            submission.assignmentId,
            submission.student,
            submission.photoHash,
            submission.submittedAt,
            submission.status,
            submission.approvedBy,
            submission.approvedAt,
            submission.rejectionReason
        );
    }

    function getStudentAssignments(
        address student
    ) external view returns (uint256[] memory) {
        return studentAssignments[student];
    }

    function getAssignmentStudents(
        uint256 assignmentId
    ) external view returns (address[] memory) {
        return assignmentStudents[assignmentId];
    }

    function getAssignmentSubmissions(
        uint256 assignmentId
    ) external view returns (uint256[] memory) {
        return assignmentSubmissions[assignmentId];
    }

    function getTeacherAssignments(
        address teacher
    ) external view returns (uint256[] memory) {
        return teacherAssignments[teacher];
    }

    function isStudentAssigned(
        uint256 assignmentId,
        address student
    ) external view returns (bool) {
        return isAssigned[assignmentId][student];
    }

    function hasStudentSubmitted(
        uint256 assignmentId,
        address student
    ) external view returns (bool) {
        return hasSubmitted[assignmentId][student];
    }

    function hasApprovedSubmission(
        uint256 assignmentId,
        address student
    ) external view returns (bool) {
        return _hasApprovedSubmission(assignmentId, student);
    }

    // ═══════════════════════════════════════════════════════════════
    // Hackathon feature
    // (independent of the classroom assignment system above)
    // ═══════════════════════════════════════════════════════════════

    // ─── Admin ────────────────────────────────────────────────────

    function addHackathonHost(address host) external onlyOwner {
        if (host == address(0)) revert InvalidAddress();
        isApprovedHost[host] = true;
        emit ApprovedHostAdded(host);
    }

    function removeHackathonHost(address host) external onlyOwner {
        isApprovedHost[host] = false;
        emit ApprovedHostRemoved(host);
    }

    function setMaxXRDMPerParticipant(uint256 amount) external onlyOwner {
        uint256 oldValue = maxXRDMPerParticipant;
        maxXRDMPerParticipant = amount;
        emit MaxXRDMPerParticipantUpdated(oldValue, amount);
    }

    // ─── Host lifecycle ───────────────────────────────────────────

    function createHackathon() external nonReentrant returns (uint256 hackathonId) {
        if (!isApprovedHost[msg.sender]) revert NotApprovedHost();
        hackathonId = ++nextHackathonId;
        hackathons[hackathonId].host = msg.sender;
        emit HackathonCreated(hackathonId, msg.sender);
    }

    function registerParticipants(
        uint256 hackathonId,
        address[] calldata participants
    ) external nonReentrant {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        if (h.host != msg.sender) revert NotHackathonHost();
        if (participants.length == 0) revert EmptyArray();

        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == address(0)) revert InvalidAddress();
            h.isParticipant[participants[i]] = true;
        }

        emit ParticipantsRegistered(hackathonId, participants);
    }

    function awardXRDM(
        uint256 hackathonId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        if (h.host != msg.sender) revert NotHackathonHost();
        if (recipients.length == 0) revert EmptyArray();
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();

        uint256 cap = maxXRDMPerParticipant;
        uint256[] memory tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            if (!h.isParticipant[recipient]) revert NotAParticipant();
            if (amount == 0) revert InvalidAmount();

            uint256 newTotal = h.xrdmAwarded[recipient] + amount;
            if (cap != 0 && newTotal > cap) revert ExceedsPerParticipantCap();
            h.xrdmAwarded[recipient] = newTotal;

            uint256 tokenId = uint256(keccak256(abi.encodePacked(hackathonId, recipient, "HACK_XRDM")));
            tokenIds[i] = tokenId;

            emit XRDMAwarded(hackathonId, recipient, amount, tokenId);
        }

        xrdmToken.mintBatchSoulboundTokensWithAmounts(recipients, tokenIds, amounts, hackathonId);
    }

    function noteWinners(
        uint256 hackathonId,
        address[] calldata winners
    ) external nonReentrant {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        if (h.host != msg.sender) revert NotHackathonHost();
        if (winners.length == 0) revert EmptyArray();

        for (uint256 i = 0; i < winners.length; i++) {
            address winner = winners[i];
            if (!h.isParticipant[winner]) revert NotAParticipant();
            h.isWinner[winner] = true;
        }

        emit WinnersNoted(hackathonId, winners);
    }

    function awardNFT(
        uint256 hackathonId,
        address recipient,
        string calldata uri
    ) external nonReentrant {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        if (h.host != msg.sender) revert NotHackathonHost();
        if (!h.isParticipant[recipient]) revert NotAParticipant();

        h.nftCounter += 1;
        uint256 tokenId = uint256(keccak256(abi.encodePacked(hackathonId, recipient, "HACK_NFT", h.nftCounter)));

        xrdmToken.mintSoulboundToken(recipient, tokenId, 1, hackathonId);
        xrdmToken.setTokenURI(tokenId, uri);

        emit NFTAwarded(hackathonId, recipient, tokenId, uri);
    }

    // ─── Views ────────────────────────────────────────────────────

    function getHackathonHost(uint256 hackathonId) external view returns (address) {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        return h.host;
    }

    function isHackathonParticipant(uint256 hackathonId, address addr) external view returns (bool) {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        return h.isParticipant[addr];
    }

    function isHackathonWinner(uint256 hackathonId, address addr) external view returns (bool) {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        return h.isWinner[addr];
    }

    function getXRDMAwardedInHackathon(uint256 hackathonId, address addr) external view returns (uint256) {
        Hackathon storage h = hackathons[hackathonId];
        if (h.host == address(0)) revert HackathonNotFound();
        return h.xrdmAwarded[addr];
    }
}
