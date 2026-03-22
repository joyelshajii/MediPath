'use strict';

// ─── MediPath Feedback Engine ─────────────────────────────
// A fully transparent, no-AI algorithmic text processor
// for patient feedback analysis.

// ─── Stop Words ───────────────────────────────────────────
const STOP_WORDS = new Set([
  'i','me','my','myself','we','our','ours','ourselves','you','your','yours',
  'yourself','yourselves','he','him','his','himself','she','her','hers',
  'herself','it','its','itself','they','them','their','theirs','themselves',
  'what','which','who','whom','this','that','these','those','am','is','are',
  'was','were','be','been','being','have','has','had','having','do','does',
  'did','doing','a','an','the','and','but','if','or','because','as','until',
  'while','of','at','by','for','with','about','against','between','through',
  'during','before','after','above','below','to','from','up','down','in',
  'out','on','off','over','under','again','further','then','once','here',
  'there','when','where','why','how','all','both','each','few','more','most',
  'other','some','such','no','nor','not','only','own','same','so','than',
  'too','very','s','t','can','will','just','don','should','now','d','ll',
  'm','o','re','ve','y','ain','aren','couldn','didn','doesn','hadn','hasn',
  'haven','isn','ma','mightn','mustn','needn','shan','shouldn','wasn',
  'weren','won','wouldn','would','could','might','shall','may','also',
  'really','went','got','go','going','get','getting','like','even','much',
  'well','back','still','way','take','make','come','see','know','think',
  'thing','things','lot','say','said','told','tell','asked','want','need',
  'one','two','first','time','times','day','days','hospital','doctor','dr',
  'visit','visited','appointment','patient','office','clinic','medical',
  'health','care','experience','felt','feel','feeling','overall','always',
  'never','every','everything','nothing','something','anything','someone',
  'everyone','everyone','anyone','nobody','people','person','year','years',
  'month','months','week','weeks','ago','since','last','next','new','old',
  'good','bad','great','best','worst','better','worse','many','several',
  'little','bit','quite','pretty','enough','long','short','high','low',
  'big','small','sure','right','left','put','give','gave','given','took',
  'done','made','found','keep','kept','let','help','helped'
]);

// ─── Sentiment Dictionaries ──────────────────────────────
const POSITIVE_WORDS = {
  // Bedside manner
  'caring': 3, 'compassionate': 3, 'empathetic': 3, 'kind': 2, 'gentle': 2,
  'warm': 2, 'friendly': 2, 'understanding': 2, 'supportive': 2, 'patient': 3,
  'respectful': 2, 'attentive': 3, 'considerate': 2, 'reassuring': 2,
  // Communication
  'explains': 3, 'explained': 3, 'listens': 3, 'listened': 3, 'communicates': 2,
  'clear': 2, 'thorough': 3, 'detailed': 2, 'informative': 2, 'transparent': 2,
  'answers': 2, 'responsive': 2,
  // Competence
  'skilled': 3, 'knowledgeable': 3, 'experienced': 3, 'competent': 2,
  'professional': 3, 'expert': 3, 'accurate': 2, 'precise': 2, 'brilliant': 3,
  'talented': 3, 'qualified': 2, 'capable': 2, 'efficient': 2,
  // Outcomes
  'cured': 3, 'healed': 3, 'recovered': 3, 'improved': 2, 'relieved': 2,
  'effective': 3, 'successful': 3, 'resolved': 2, 'fixed': 2,
  // Environment
  'clean': 2, 'organized': 2, 'comfortable': 2, 'modern': 2, 'hygienic': 2,
  'tidy': 1, 'pleasant': 2, 'welcoming': 2,
  // General
  'excellent': 3, 'outstanding': 3, 'wonderful': 3, 'fantastic': 3,
  'amazing': 3, 'superb': 3, 'terrific': 3, 'exceptional': 3,
  'recommend': 3, 'recommended': 3, 'pleased': 2, 'satisfied': 2,
  'happy': 2, 'grateful': 2, 'thankful': 2, 'impressed': 3,
  'quick': 2, 'fast': 2, 'prompt': 2, 'timely': 2, 'punctual': 2,
  'affordable': 2, 'reasonable': 1, 'dedicated': 3, 'reliable': 2,
  'trustworthy': 3, 'honest': 2, 'diligent': 2, 'helpful': 2,
  'polite': 2, 'courteous': 2, 'thoughtful': 2, 'genuine': 2,
  'safe': 2, 'calm': 2, 'painless': 2, 'smooth': 2, 'easy': 1,
  'love': 2, 'loved': 2, 'perfect': 3, 'top': 2, 'best': 3
};

const NEGATIVE_WORDS = {
  // Bedside manner
  'rude': -3, 'cold': -2, 'dismissive': -3, 'arrogant': -3, 'impatient': -3,
  'uncaring': -3, 'insensitive': -3, 'harsh': -2, 'mean': -2, 'condescending': -3,
  'unfriendly': -2, 'disrespectful': -3, 'abrupt': -2, 'indifferent': -2,
  // Communication
  'ignored': -3, 'rushed': -3, 'hurried': -2, 'vague': -2, 'confusing': -2,
  'unclear': -2, 'unresponsive': -3, 'unavailable': -2,
  // Competence
  'incompetent': -3, 'careless': -3, 'negligent': -3, 'unprofessional': -3,
  'inexperienced': -2, 'sloppy': -2, 'inaccurate': -2, 'misdiagnosed': -3,
  'mistake': -2, 'mistakes': -2, 'error': -2, 'errors': -2, 'wrong': -2,
  // Outcomes
  'worsened': -3, 'painful': -2, 'pain': -1, 'suffering': -2, 'complications': -2,
  'infection': -2, 'side-effects': -2, 'failed': -3, 'unsuccessful': -3,
  // Environment
  'dirty': -3, 'unclean': -3, 'messy': -2, 'crowded': -2, 'noisy': -1,
  'disorganized': -2, 'unhygienic': -3,
  // Wait & Time
  'waiting': -2, 'waited': -2, 'delay': -2, 'delayed': -2, 'late': -2,
  'slow': -2, 'overcharged': -3, 'expensive': -2, 'overpriced': -2,
  // General
  'terrible': -3, 'horrible': -3, 'awful': -3, 'dreadful': -3,
  'disappointing': -3, 'disappointed': -3, 'frustrated': -2, 'frustrating': -2,
  'angry': -2, 'upset': -2, 'unhappy': -2, 'dissatisfied': -3,
  'avoid': -3, 'never': -1, 'worst': -3, 'poor': -2, 'bad': -2,
  'hate': -3, 'hated': -3, 'scary': -2, 'scared': -2, 'fear': -2,
  'danger': -3, 'dangerous': -3, 'unsafe': -3, 'unpleasant': -2,
  'uncomfortable': -2, 'unreliable': -2, 'untrustworthy': -3
};

// ─── Trait Labels ─────────────────────────────────────────
const POSITIVE_TRAIT_LABELS = {
  'caring': 'Caring Demeanor', 'compassionate': 'Compassionate Care',
  'empathetic': 'Empathetic Approach', 'kind': 'Kind Personality',
  'gentle': 'Gentle Treatment', 'patient': 'Patient Interaction',
  'attentive': 'Attentive Listening', 'listens': 'Good Listener',
  'listened': 'Good Listener', 'explains': 'Clear Communication',
  'explained': 'Clear Communication', 'thorough': 'Thorough Examination',
  'skilled': 'Skilled Practitioner', 'knowledgeable': 'Deep Knowledge',
  'experienced': 'Rich Experience', 'professional': 'High Professionalism',
  'expert': 'Expert-Level Care', 'efficient': 'Efficient Service',
  'clean': 'Clean Environment', 'comfortable': 'Comfortable Setting',
  'excellent': 'Excellent Overall', 'recommend': 'Highly Recommended',
  'recommended': 'Highly Recommended', 'quick': 'Quick Service',
  'prompt': 'Prompt Attention', 'punctual': 'Punctual Schedule',
  'friendly': 'Friendly Attitude', 'helpful': 'Helpful Staff',
  'dedicated': 'Dedicated Care', 'trustworthy': 'Trustworthy Doctor',
  'polite': 'Polite Conduct', 'safe': 'Safe Environment',
  'painless': 'Painless Procedure', 'relieved': 'Effective Relief',
  'cured': 'Successful Treatment', 'effective': 'Effective Treatment'
};

const NEGATIVE_TRAIT_LABELS = {
  'rude': 'Rude Behavior', 'rushed': 'Rushed Consultations',
  'dismissive': 'Dismissive Attitude', 'arrogant': 'Arrogant Manner',
  'impatient': 'Impatient Interaction', 'waiting': 'Long Wait Times',
  'waited': 'Long Wait Times', 'delay': 'Frequent Delays',
  'delayed': 'Frequent Delays', 'dirty': 'Cleanliness Concerns',
  'unclean': 'Cleanliness Concerns', 'expensive': 'High Cost',
  'overcharged': 'Overcharging Issues', 'painful': 'Pain During Procedures',
  'incompetent': 'Competency Concerns', 'careless': 'Careless Handling',
  'negligent': 'Negligent Care', 'unprofessional': 'Unprofessional Conduct',
  'ignored': 'Feeling Ignored', 'cold': 'Cold Demeanor',
  'slow': 'Slow Service', 'crowded': 'Overcrowded Facility',
  'confusing': 'Confusing Instructions', 'misdiagnosed': 'Misdiagnosis Concerns',
  'uncomfortable': 'Uncomfortable Experience', 'unfriendly': 'Unfriendly Staff'
};

// ─── Core Processing Functions ────────────────────────────

/**
 * Tokenize and clean text: lowercase, remove punctuation, split into words
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Extract high-frequency keywords from token list
 * Returns sorted array of { word, count }
 */
function extractKeywords(tokens) {
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate sentiment score using dictionary-based approach.
 * Returns { score (0-100), positiveMatches, negativeMatches, totalMatched }
 */
function calculateSentiment(tokens) {
  let posScore = 0, negScore = 0;
  const positiveMatches = [];
  const negativeMatches = [];

  const counted = {};
  tokens.forEach(token => {
    if (counted[token]) return;
    if (POSITIVE_WORDS[token] !== undefined) {
      posScore += POSITIVE_WORDS[token];
      positiveMatches.push(token);
      counted[token] = true;
    }
    if (NEGATIVE_WORDS[token] !== undefined) {
      negScore += Math.abs(NEGATIVE_WORDS[token]);
      negativeMatches.push(token);
      counted[token] = true;
    }
  });

  const totalMatched = posScore + negScore;
  // Normalize to 0-100 scale. 50 = neutral, 100 = perfect, 0 = terrible
  let score = 50; // neutral default
  if (totalMatched > 0) {
    score = Math.round((posScore / totalMatched) * 100);
  }

  return { score, posScore, negScore, positiveMatches, negativeMatches, totalMatched };
}

/**
 * Generate a human-readable summary from keyword analysis.
 * Format: "Patients praise [trait1], [trait2], and [trait3]. Primary area for improvement: [neg_trait]."
 */
function generateSummary(positiveMatches, negativeMatches, keywords) {
  // Get top 3 positive traits with labels
  const topPositive = positiveMatches
    .slice(0, 5)
    .map(w => POSITIVE_TRAIT_LABELS[w] || w)
    .filter((v, i, a) => a.indexOf(v) === i) // unique labels
    .slice(0, 3);

  // Get primary negative trait
  const topNegative = negativeMatches
    .slice(0, 3)
    .map(w => NEGATIVE_TRAIT_LABELS[w] || w)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 1);

  let summary = '';

  if (topPositive.length > 0) {
    if (topPositive.length === 1) {
      summary = `Patients praise: ${topPositive[0]}.`;
    } else if (topPositive.length === 2) {
      summary = `Patients praise: ${topPositive[0]} and ${topPositive[1]}.`;
    } else {
      summary = `Patients praise: ${topPositive.slice(0, -1).join(', ')}, and ${topPositive[topPositive.length - 1]}.`;
    }
  }

  if (topNegative.length > 0) {
    summary += ` Primary area for improvement: ${topNegative[0]}.`;
  }

  if (!summary) {
    summary = 'Insufficient feedback data for summary generation.';
  }

  return summary.trim();
}

/**
 * Main processing pipeline — takes raw review text and returns full analysis.
 */
function processFeedback(rawText) {
  const tokens = tokenize(rawText);
  const keywords = extractKeywords(tokens);
  const sentiment = calculateSentiment(tokens);
  const summary = generateSummary(sentiment.positiveMatches, sentiment.negativeMatches, keywords);

  return {
    sentimentScore: sentiment.score,
    keywords: keywords.slice(0, 15), // top 15
    positiveTraits: sentiment.positiveMatches.map(w => POSITIVE_TRAIT_LABELS[w] || w),
    negativeTraits: sentiment.negativeMatches.map(w => NEGATIVE_TRAIT_LABELS[w] || w),
    summary,
    // Raw data for transparency
    _debug: {
      tokenCount: tokens.length,
      posScore: sentiment.posScore,
      negScore: sentiment.negScore,
      totalMatched: sentiment.totalMatched
    }
  };
}

/**
 * Generate aggregate report for a doctor from multiple feedback entries.
 */
function generateDoctorReport(feedbackRows) {
  if (!feedbackRows || feedbackRows.length === 0) {
    return {
      averageScore: 0,
      totalReviews: 0,
      summary: 'No feedback received yet.',
      topPositive: [],
      topNegative: [],
      keywordCloud: []
    };
  }

  // Aggregate all tokens from all reviews
  const allTokens = [];
  let totalScore = 0;
  const allPositive = {};
  const allNegative = {};

  feedbackRows.forEach(row => {
    const tokens = tokenize(row.raw_text);
    allTokens.push(...tokens);

    const sentiment = calculateSentiment(tokens);
    totalScore += row.sentiment_score || sentiment.score;

    sentiment.positiveMatches.forEach(w => {
      const label = POSITIVE_TRAIT_LABELS[w] || w;
      allPositive[label] = (allPositive[label] || 0) + 1;
    });
    sentiment.negativeMatches.forEach(w => {
      const label = NEGATIVE_TRAIT_LABELS[w] || w;
      allNegative[label] = (allNegative[label] || 0) + 1;
    });
  });

  const avgScore = Math.round(totalScore / feedbackRows.length);
  const keywords = extractKeywords(allTokens).slice(0, 20);

  const topPositive = Object.entries(allPositive)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([trait, count]) => ({ trait, count }));

  const topNegative = Object.entries(allNegative)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([trait, count]) => ({ trait, count }));

  // Generate aggregate summary
  const posLabels = topPositive.slice(0, 3).map(t => t.trait);
  const negLabels = topNegative.slice(0, 1).map(t => t.trait);
  const summary = generateSummary(
    topPositive.map(t => t.trait),
    topNegative.map(t => t.trait),
    keywords
  );

  return {
    averageScore: avgScore,
    totalReviews: feedbackRows.length,
    summary,
    topPositive,
    topNegative,
    keywordCloud: keywords
  };
}

module.exports = { processFeedback, generateDoctorReport, tokenize, extractKeywords, calculateSentiment };
