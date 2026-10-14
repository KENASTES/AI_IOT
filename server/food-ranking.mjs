const preferenceRules = {
  time: {
    "รีบมาก 10 นาที": { tag: "quick", label: "เวลา", weight: 25 },
  },
  hunger: {
    "กินเล่น": { tag: "snack", label: "ความอิ่ม", weight: 15 },
    "หิวจนตาลาย": { tag: "filling", label: "ความอิ่ม", weight: 15 },
  },
  mood: {
    "ฮีลใจ": { tag: "comfort", label: "อารมณ์", weight: 40 },
    "ของแซ่บ": { tag: "spicy", label: "อารมณ์", weight: 40 },
    "เบาแต่ไม่จืด": { tag: "healthy", label: "อารมณ์", weight: 40 },
  },
  goal: {
    "โปรตีน": { tag: "protein", label: "เป้าหมายโปรตีน", weight: 15 },
  },
};

function normalizedTags(candidate) {
  return new Set((Array.isArray(candidate.tags) ? candidate.tags : [])
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim().toLocaleLowerCase("th")));
}

/**
 * Produces an explainable 0-100 preference-match score from fields actually
 * present in MongoDB. Budget/allergy constraints are hard filters upstream;
 * the score ranks only eligible menus and is not a calibrated AI accuracy.
 */
export function scoreCandidates(candidates, preferences, maxBudgetThb) {
  const criteria = [{
    label: "งบ",
    weight: 30,
    score: (candidate) => maxBudgetThb > 0
      ? Math.max(0, 100 - (30 * candidate.price) / maxBudgetThb)
      : candidate.price === 0 ? 100 : 0,
  }];
  const unsupported = [];

  for (const [category, rules] of Object.entries(preferenceRules)) {
    const answer = preferences?.[category];
    if (typeof answer !== "string" || !answer) continue;
    const rule = rules[answer];
    if (!rule) {
      if (category === "time" && answer === "สบาย ๆ 20 นาที") {
        unsupported.push("เวลาเตรียมอาหาร (ข้อมูลร้านยังไม่มีเวลาเป็นนาที)");
      } else if (category === "hunger" && answer !== "กำลังดี") {
        unsupported.push("ระดับความอิ่ม (ข้อมูลร้านยังไม่มี tag ที่ใช้วัด)");
      } else if (category === "goal" && answer === "โปรตีน") {
        unsupported.push("โปรตีน (ข้อมูลร้านยังไม่มี tag protein)");
      } else if (category === "goal" && answer === "เซอร์ไพรส์ฉัน") {
        unsupported.push("ความหลากหลาย (ยังไม่มีประวัติเมนูที่ผู้ใช้เคยเลือก)");
      }
      continue;
    }

    if (!candidates.some((candidate) => normalizedTags(candidate).has(rule.tag))) {
      unsupported.push(`${rule.label} (${rule.tag})`);
      continue;
    }

    criteria.push({
      label: rule.label,
      weight: rule.weight,
      answer,
      tag: rule.tag,
      score: (candidate) => normalizedTags(candidate).has(rule.tag) ? 100 : 0,
    });
  }

  const totalWeight = criteria.reduce((total, criterion) => total + criterion.weight, 0);
  const ranked = candidates.map((candidate) => {
    const matchReasons = [];
    const weightedScore = criteria.reduce((total, criterion) => {
      const criterionScore = criterion.score(candidate);
      if (criterion.tag) {
        matchReasons.push(normalizedTags(candidate).has(criterion.tag)
          ? `ตรงกับ “${criterion.answer}” (${criterion.tag})`
          : `เมนูนี้ไม่มี tag ${criterion.tag} สำหรับ “${criterion.answer}”`);
      } else {
        matchReasons.push(`ราคา ฿${candidate.price} จากงบ ฿${maxBudgetThb}`);
      }
      return total + criterionScore * criterion.weight;
    }, 0);

    return {
      ...candidate,
      score: Math.round(weightedScore / totalWeight),
      matchReasons,
    };
  }).sort((a, b) => b.score - a.score || a.price - b.price || a.id.localeCompare(b.id));

  const evaluatedCriteria = [...new Set(criteria.map((criterion) => criterion.label))];
  const message = [
    `คะแนนเทียบจาก ${evaluatedCriteria.join(" + ")} ใน MongoDB (งบและอาหารที่แพ้เป็นตัวกรองบังคับ)`,
    unsupported.length ? `ยังไม่รวมเกณฑ์ที่ฐานข้อมูลไม่มีข้อมูล: ${unsupported.join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  return { recommendations: ranked, message, evaluatedCriteria, unsupportedCriteria: unsupported };
}
