// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vote {
    string[] public candidates;
    mapping(uint256 => uint256) public votes;
    
    // Un event pour tracer les actions (Consigne TD)
    event Voted(uint256 candidateIndex, address voter);

    constructor() {
        candidates.push("Leon Blum");
        candidates.push("Jacques Chirac");
        candidates.push("Francois Mitterrand");
    }

    // Fonction d'écriture avec require (Consigne TD)
    function vote(uint256 _candidateIndex) public {
        require(_candidateIndex < candidates.length, "Candidat invalide");
        votes[_candidateIndex]++;
        emit Voted(_candidateIndex, msg.sender);
    }

    // Fonction view 1 (Consigne TD)
    function getVotes(uint256 _candidateIndex) public view returns (uint256) {
        return votes[_candidateIndex];
    }

    // Fonction view 2 (Consigne TD)
    function getCandidatesCount() public view returns (uint256) {
        return candidates.length;
    }
}
