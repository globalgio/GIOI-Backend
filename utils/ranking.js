// utils/ranking.js

const getRankAndCategory = (score, jsonData, maxScore) => {
  if (score === maxScore) {
    return { rank: 1, category: "Gold" };
  }

  // Find the matching score entry in the JSON data
  const entry = jsonData.find((item) => item.score === score);

  if (!entry) {
    return { rank: "Unranked", category: "Unranked" };
  }

  const [start, end] = entry.rankRange.split(" to ").map(Number);
  const randomRank = Math.floor(Math.random() * (end - start + 1)) + start;

  return { rank: randomRank, category: entry.category };
};

module.exports = { getRankAndCategory };
