
// Simple baseline scoring (no context awareness)
export function computeBaselineScore(trip) {
  if (!trip) return null;

  const {
    overspeedPercent,
    harshBrakes,
    harshAccel,
    nightDrivingPercent,
  } = trip;

  // Fixed weights for baseline
  const wBrake = 0.25;
  const wSpeed = 0.4;
  const wNight = 0.2;
  const wAccel = 0.15;

  const brakeRisk = Math.min((harshBrakes || 0) / 4, 1);
  const accelRisk = Math.min((harshAccel || 0) / 4, 1);
  const overspeedRisk = Math.min(Math.max(overspeedPercent || 0, 0), 1);
  const nightRisk = Math.min(Math.max(nightDrivingPercent || 0, 0), 1);

  const totalRisk =
    wBrake * brakeRisk +
    wSpeed * overspeedRisk +
    wNight * nightRisk +
    wAccel * accelRisk;

  const score = Math.round(100 * (1 - totalRisk));
  return Math.max(0, Math.min(100, score));
}

function getContextWeights(roadType, trafficDensity, borough) {
  // Base weights
  let wBrake = 0.25;
  let wSpeed = 0.4;
  let wNight = 0.2;
  let wAccel = 0.15;

  // Borough-specific adjustments (can be positive or negative)
  const boroughMultipliers = {
    "Manhattan": { brake: -0.15, speed: 0.2, night: 0.05, accel: -0.1 }, // Stricter on speed, more forgiving on brakes
    "Brooklyn": { brake: -0.1, speed: 0.15, night: 0.05, accel: -0.1 },
    "Queens": { brake: 0.05, speed: -0.1, night: 0.1, accel: 0.05 }, // More forgiving on speed, stricter on night
    "Bronx": { brake: 0.1, speed: 0.1, night: 0.15, accel: 0.05 }, // Stricter on night driving
    "Staten Island": { brake: 0.15, speed: -0.15, night: 0.2, accel: 0.1 }, // Much stricter on night, more forgiving on speed
  };

  if (borough && boroughMultipliers[borough]) {
    const mult = boroughMultipliers[borough];
    wBrake += mult.brake;
    wSpeed += mult.speed;
    wNight += mult.night;
    wAccel += mult.accel;
  }

  // Road type adjustments
  if (roadType === "urban") {
    wBrake -= 0.08; // Slightly more forgiving of braking in urban (reduced from 0.1)
    wSpeed += 0.15; // Stricter on speeding in urban (can negatively impact)
    wNight += 0.05; // Slightly stricter on night driving
    wAccel += 0.02; // Slightly stricter on acceleration in urban
  }
  if (roadType === "rural") {
    // Rural areas: MUCH stricter penalties for bad driving
    wBrake += 0.25; // Much stricter on braking in rural (can negatively impact)
    wNight += 0.2; // Much stricter on night driving (can negatively impact)
    wAccel += 0.1; // Stricter on harsh acceleration
    wSpeed += 0.05; // Slightly stricter on speed (rural speeding is dangerous)
  }

  // Traffic density adjustments
  if (trafficDensity === 3) {
    // Dense traffic → expect braking, but speeding is very dangerous
    wBrake -= 0.08;
    wSpeed += 0.12; // Much stricter on speeding (can negatively impact)
    wAccel -= 0.04;
  } else if (trafficDensity === 1) {
    // Empty roads → braking and night driving are more suspicious
    wBrake += 0.12; // Stricter on braking (can negatively impact)
    wNight += 0.1; // Stricter on night (can negatively impact)
    wSpeed -= 0.08;
  } else if (trafficDensity === 2) {
    // Medium traffic - balanced
    wBrake += 0.02;
    wSpeed += 0.02;
  }

  // Normalize weights to sum to 1
  const sum = wBrake + wSpeed + wNight + wAccel;
  return {
    wBrake: wBrake / sum,
    wSpeed: wSpeed / sum,
    wNight: wNight / sum,
    wAccel: wAccel / sum,
  };
}

// Check if driving is ridiculously bad regardless of context
export function isSeverelyBadDriving(trip) {
  const {
    overspeedPercent,
    harshBrakes,
    harshAccel,
  } = trip;

  // Define thresholds for "ridiculously bad" driving
  const severeOverspeed = overspeedPercent > 0.5; // More than 50% of time overspeeding
  const severeBrakes = harshBrakes >= 6; // 6+ harsh brakes
  const severeAccel = harshAccel >= 6; // 6+ harsh accelerations
  const multipleSevereIssues = 
    (harshBrakes >= 4 && overspeedPercent > 0.3) ||
    (harshAccel >= 4 && overspeedPercent > 0.3) ||
    (harshBrakes >= 4 && harshAccel >= 4);

  return severeOverspeed || severeBrakes || severeAccel || multipleSevereIssues;
}

// Calculate rural penalty multiplier based on bad driving behavior
export function getRuralPenaltyMultiplier(roadType, brakeRisk, speedRisk, nightRisk, accelRisk) {
  if (roadType !== "rural") return 1.0;

  // Calculate overall bad driving severity
  const badDrivingSeverity = (brakeRisk + speedRisk + nightRisk + accelRisk) / 4;
  
  // Apply increasing penalty multiplier for worse driving in rural areas
  // Base multiplier: 1.0 (no penalty for good driving)
  // Max multiplier: 1.5 (50% penalty for very bad driving)
  const penaltyMultiplier = 1.0 + (badDrivingSeverity * 0.5);
  
  return penaltyMultiplier;
}

export function computeSafetyScore(trip) {
  if (!trip) return null;

  const {
    overspeedPercent,
    harshBrakes,
    harshAccel,
    nightDrivingPercent,
    roadType,
    trafficDensity,
    borough,
  } = trip;

  const { wBrake, wSpeed, wNight, wAccel } = getContextWeights(
    roadType || "urban",
    trafficDensity || 2,
    borough
  );

  const brakeRisk = Math.min((harshBrakes || 0) / 4, 1);
  const accelRisk = Math.min((harshAccel || 0) / 4, 1);
  const overspeedRisk = Math.min(Math.max(overspeedPercent || 0, 0), 1);
  const nightRisk = Math.min(Math.max(nightDrivingPercent || 0, 0), 1);

  let totalRisk =
    wBrake * brakeRisk +
    wSpeed * overspeedRisk +
    wNight * nightRisk +
    wAccel * accelRisk;

  // Apply urban minimum risk floor - prevent perfect scores with bad driving
  // Urban areas are more forgiving, but bad driving should still be penalized
  if (roadType === "urban") {
    const hasBadDriving = brakeRisk > 0.15 || overspeedRisk > 0.15 || 
                          nightRisk > 0.15 || accelRisk > 0.15;
    if (hasBadDriving) {
      // Calculate worst behavior
      const worstBehavior = Math.max(brakeRisk, overspeedRisk, nightRisk, accelRisk);
      // Ensure minimum risk is at least 20% of worst behavior for urban areas
      // This prevents perfect scores while still being more forgiving than baseline
      const minRisk = worstBehavior * 0.2;
      totalRisk = Math.max(totalRisk, minRisk);
    }
  }

  // Apply rural penalty multiplier for bad driving in rural areas
  const ruralPenalty = getRuralPenaltyMultiplier(
    roadType || "urban",
    brakeRisk,
    overspeedRisk,
    nightRisk,
    accelRisk
  );
  
  // If in rural area with bad driving, multiply the risk
  if (roadType === "rural" && totalRisk > 0.2) {
    // Only apply penalty if there's significant bad driving
    totalRisk = Math.min(1.0, totalRisk * ruralPenalty);
  }

  // Apply severe penalty for ridiculously bad driving regardless of context
  const isSevere = isSeverelyBadDriving(trip);
  if (isSevere) {
    // Apply additional 20-40% penalty based on severity
    const severeMultiplier = 1.2 + (totalRisk * 0.2); // 1.2 to 1.4 multiplier
    totalRisk = Math.min(1.0, totalRisk * severeMultiplier);
  }

  const score = Math.round(100 * (1 - totalRisk));
  return Math.max(0, Math.min(100, score));
}
  