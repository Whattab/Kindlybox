export interface QuizAnswers {
  recipient: string;
  occasion: string;
  interests: string[];
  budget: string;
  ageGroup: string;
  gender: string;
  freeText?: string;
  recipientName?: string;
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

const MAX_SCORE = 30 + 25 + (15 * 3) + 20; // 100-ish with room for free-text relevance

function normalizeText(value: string): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenMatchesHaystack(token: string, haystack: string): boolean {
  if (haystack.includes(token)) {
    return true;
  }

  if (token.length > 3 && token.endsWith("s") && haystack.includes(token.slice(0, -1))) {
    return true;
  }

  if (token.length > 3 && !token.endsWith("s") && haystack.includes(`${token}s`)) {
    return true;
  }

  return false;
}

function getThemeSignals(text: string): string[] {
  const normalized = normalizeText(text);
  const aliases: Record<string, string[]> = {
    books: ["book", "books", "reading", "novel", "literature", "library"],
    food: ["cook", "cooking", "food", "kitchen", "baking", "coffee", "tea"],
    travel: ["travel", "trip", "adventure", "wander", "explore", "holiday"],
    home: ["home", "decor", "cozy", "comfort", "candle", "house", "bath", "bathroom", "towel", "towels", "linens"],
    tech: ["tech", "gadget", "device", "digital", "smart", "electronics"],
    wellness: ["wellness", "wellbeing", "fitness", "spa", "selfcare", "relax"],
    fashion: ["fashion", "style", "clothes", "accessories", "beauty"],
    sport: ["sport", "active", "gym", "outdoor", "running", "hike"],
  };

  return Object.entries(aliases)
    .filter(([, words]) => words.some((word) => normalized.includes(word)))
    .map(([signal]) => signal);
}

export function getRecommendations(answers: QuizAnswers, catalogue: Gift[]): GiftScore[] {
  const freeText = (answers.freeText || "").trim().toLowerCase();
  const freeTextTokens = freeText
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((token) => token.length > 2);

  // Combine theme signals from both the free-text box AND the structured interests
  // so that selecting "home & kitchen" or "home decor" also surfaces gifts tagged
  // with related keywords like "towel", "bath", "linens" etc.
  const interestsText = (answers.interests ?? []).join(" ");
  const combinedSignalText = [freeText, interestsText].filter(Boolean).join(" ");
  const themeSignals = getThemeSignals(combinedSignalText);

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

    // Free-text hints should be visible even with a small catalog.
    if (freeTextTokens.length > 0 || themeSignals.length > 0) {
      const haystacks = [
        gift.name,
        gift.description,
        ...(gift.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchingTokens = freeTextTokens.filter((token) => tokenMatchesHaystack(token, haystacks));
      const matchingThemes = themeSignals.filter((signal) => tokenMatchesHaystack(signal, haystacks));

      score += Math.min(matchingTokens.length, 4) * 6;
      score += Math.min(matchingThemes.length, 3) * 8;

      if (matchingTokens.length > 0 || matchingThemes.length > 0) {
        score += 6;
      }
    }

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
