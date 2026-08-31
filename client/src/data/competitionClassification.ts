export type CompetitionSex = "Female" | "Male";
export type PowerliftingExperience = "Novice" | "Experienced";
export type PowerliftingEquipment = "Classic" | "Equipped";

export function ipfEligibleAgeDivisions(dateOfBirth: string, year = new Date().getUTCFullYear()) {
  const classification = ipfClassification(dateOfBirth, "Female", 1, year);
  return classification ? classification.ageDivision === "Open" ? ["Open"] : [classification.ageDivision, "Open"] : ["Open"];
}

export function ipfWeightClasses(sex: CompetitionSex, ageDivision: string) {
  const youth = ageDivision === "Sub-Junior" || ageDivision === "Junior";
  return sex === "Female"
    ? (youth ? ["43", "47", "52", "57", "63", "69", "76", "84", "84+"] : ["47", "52", "57", "63", "69", "76", "84", "84+"])
    : (youth ? ["53", "59", "66", "74", "83", "93", "105", "120", "120+"] : ["59", "66", "74", "83", "93", "105", "120", "120+"]);
}

export function ipfClassification(dateOfBirth: string, sex: CompetitionSex, bodyWeightKg: number, year = new Date().getUTCFullYear()) {
  const birthYear = Number(dateOfBirth.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !Number.isInteger(birthYear) || bodyWeightKg <= 0) return null;
  const age = year - birthYear;
  const ageDivision = age <= 18 ? "Sub-Junior" : age <= 23 ? "Junior" : age >= 70 ? "Master IV" : age >= 60 ? "Master III" : age >= 50 ? "Master II" : age >= 40 ? "Master I" : "Open";
  const youth = age <= 23;
  const limits = sex === "Female" ? (youth ? [43, 47, 52, 57, 63, 69, 76, 84] : [47, 52, 57, 63, 69, 76, 84]) : (youth ? [53, 59, 66, 74, 83, 93, 105, 120] : [59, 66, 74, 83, 93, 105, 120]);
  const limit = limits.find((item) => bodyWeightKg <= item);
  return { calendarAge: age, ageDivision, weightClass: limit ? `${limit} kg` : `${limits.at(-1)}+ kg` };
}