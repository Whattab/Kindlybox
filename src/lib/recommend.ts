export interface QuizAnswers {
  recipient: string;
  occasion: string;
  interests: string[];
  budget: string;
  ageGroup: string;
  gender: string;
}

export interface Gift {
  id: string;
  name: string;
  description: string;
  image_url: string;
  price_min: number;
  price_max: number;
  tags: string[];
  occasions: string[];
  recipients: string[];
  affiliate_url: string | null;
  affiliate_network: string | null;
  active: boolean;
}

export interface GiftScore {
  gift: Gift;
  score: number;
  matchScorePercent: number;
}

const MAX_SCORE = 30 + 25 + (15 * 3); // 100

export function getRecommendations(answers: QuizAnswers, catalogue: Gift[]): GiftScore[] {
  // 1. Filter by budget
  const filteredGifts = catalogue.filter(gift => {
    switch (answers.budget) {
      case 'under-25':
        return gift.price_min < 25;
      case '25-50':
        return gift.price_max >= 25 && gift.price_min <= 50;
      case '50-100':
        return gift.price_max >= 50 && gift.price_min <= 100;
      case '100-200':
        return gift.price_max >= 100 && gift.price_min <= 200;
      case 'no-limit':
        return true;
      default:
        return true;
    }
  });

  // 2. Score remaining gifts
  const scoredGifts: GiftScore[] = filteredGifts.map(gift => {
    let score = 0;

    // +30 points if recipient matches
    if (gift.recipients && gift.recipients.includes(answers.recipient)) {
      score += 30;
    }

    // +25 points if occasion matches
    if (gift.occasions && gift.occasions.includes(answers.occasion)) {
      score += 25;
    }

    // +15 points per matching interest
    let matchingInterestsCount = 0;
    if (gift.tags && answers.interests) {
      for (const interest of answers.interests) {
        if (gift.tags.includes(interest)) {
          matchingInterestsCount++;
        }
      }
      
      // Bonus points if gender or age match tags too
      if (answers.gender && gift.tags.includes(answers.gender)) {
        score += 10;
      }
      if (answers.ageGroup && gift.tags.includes(answers.ageGroup)) {
        score += 10;
      }
    }
    // Cap matching interests to 3 (though standard quiz only allows 3 anyways)
    score += Math.min(matchingInterestsCount, 3) * 15;

    return {
      gift,
      score,
      matchScorePercent: Math.round((score / MAX_SCORE) * 100)
    };
  });

  // 3. Sort by score descending
  scoredGifts.sort((a, b) => b.score - a.score);

  // Return top 3
  return scoredGifts.slice(0, 3);
}
