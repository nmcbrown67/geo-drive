// src/App.js
import React, { useMemo, useState } from "react";
import {
  computeSafetyScore,
  computeBaselineScore,
  isSeverelyBadDriving,
  getRuralPenaltyMultiplier,
} from "./scoring";
import "./App.css";

function App() {
  return (
    <div className="app">
      <ScoreComparisonCalculator />
    </div>
  );
}

function Filters({
  boroughs,
  boroughFilter,
  setBoroughFilter,
  densityFilter,
  setDensityFilter,
}) {
  return (
    <div className="card">
      <h2>Filters</h2>
      <div className="filter-row">
        <label>Borough</label>
        <select
          value={boroughFilter}
          onChange={(e) => setBoroughFilter(e.target.value)}
        >
          {boroughs.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-row">
        <label>Traffic density</label>
        <select
          value={densityFilter}
          onChange={(e) => setDensityFilter(e.target.value)}
        >
          <option value="All">All</option>
          <option value="1">Low (1)</option>
          <option value="2">Medium (2)</option>
          <option value="3">High (3)</option>
        </select>
      </div>
    </div>
  );
}

function ScoreCard({ overallScore, trip }) {
  if (!trip) {
    return (
      <div className="card">
        <h2>Safety score</h2>
        <p>No trips loaded yet.</p>
      </div>
    );
  }

  const densityLabel =
    trip.trafficDensity === 1
      ? "Low"
      : trip.trafficDensity === 2
      ? "Medium"
      : "High";

  return (
    <div className="card score-card">
      <div className="score-main">
        <h2>Overall score</h2>
        <div className="score-circle">
          {overallScore !== null ? overallScore : "--"}
        </div>
        <p className="small">
          Average score across filtered trips. Current trip score:{" "}
          <strong>{trip.safetyScore}</strong>
        </p>
      </div>

      <div className="score-meta">
        <div>
          <span className="label">Context</span>
          <span>
            {trip.roadType} • density {densityLabel} ({trip.trafficDensity})
          </span>
        </div>
        <div>
          <span className="label">Avg speed</span>
          <span>
            {trip.avgSpeed.toFixed(1)} mph (limit ~{trip.speedLimit} mph)
          </span>
        </div>
        <div>
          <span className="label">Overspeed</span>
          <span>{Math.round(trip.overspeedPercent * 100)}% of time</span>
        </div>
      </div>
    </div>
  );
}

function TripList({ trips, selectedTripId, onSelect }) {
  return (
    <div className="card">
      <h2>Trips</h2>
      {trips.length === 0 ? (
        <p className="small">No trips for this filter.</p>
      ) : (
        <div className="trip-table">
          <table>
            <thead>
              <tr>
                <th>Borough</th>
                <th>Hour</th>
                <th>Score</th>
                <th>Density</th>
                <th>Avg speed</th>
              </tr>
            </thead>
            <tbody>
              {trips.slice(0, 50).map((t) => (
                <tr
                  key={t.id}
                  className={t.id === selectedTripId ? "selected" : ""}
                  onClick={() => onSelect(t.id)}
                >
                  <td>{t.borough}</td>
                  <td>{t.hour}</td>
                  <td>{t.safetyScore}</td>
                  <td>{t.trafficDensity}</td>
                  <td>{t.avgSpeed.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">Showing first 50 trips.</p>
        </div>
      )}
    </div>
  );
}

function TripDetail({ trip }) {
  if (!trip) return null;

  const date = new Date(trip.date);

  return (
    <div className="card">
      <h2>Selected trip</h2>
      <p className="small">
        {trip.borough} • {date.toLocaleString()} • hour {trip.hour}
      </p>
      <div className="detail-grid">
        <DetailItem label="Safety score" value={trip.safetyScore} />
        <DetailItem label="Road type" value={trip.roadType} />
        <DetailItem label="Traffic density" value={trip.trafficDensity} />
        <DetailItem
          label="Avg speed"
          value={`${trip.avgSpeed.toFixed(1)} mph`}
        />
        <DetailItem label="Speed limit (approx)" value={`${trip.speedLimit} mph`} />
        <DetailItem
          label="Overspeed"
          value={`${Math.round(trip.overspeedPercent * 100)}%`}
        />
        <DetailItem label="Harsh brakes" value={trip.harshBrakes} />
        <DetailItem label="Harsh accel" value={trip.harshAccel} />
        <DetailItem
          label="Night driving"
          value={`${Math.round(trip.nightDrivingPercent * 100)}%`}
        />
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span className="label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ContextExplanation({ trip }) {
  if (!trip) return null;

  const densityLabel =
    trip.trafficDensity === 1
      ? "low"
      : trip.trafficDensity === 2
      ? "medium"
      : "high";

  return (
    <div className="card">
      <h2>Why this score?</h2>
      <p className="small">
        This trip was classified as <strong>{trip.roadType}</strong> in{" "}
        <strong>{trip.borough}</strong> with{" "}
        <strong>{densityLabel} traffic density</strong> (
        {trip.trafficDensity}).
      </p>
      <ul className="small">
        <li>
          In <strong>dense urban</strong> traffic, the model is{" "}
          <strong>more forgiving of harsh braking</strong> and{" "}
          <strong>stricter on overspeeding</strong>.
        </li>
        <li>
          In <strong>low-density</strong> settings, sudden braking and night
          driving are treated as riskier behaviours.
        </li>
        <li>
          You can see that your overspeeding ({Math.round(
            trip.overspeedPercent * 100
          )}
          %) and harsh events ({trip.harshBrakes} brakes, {trip.harshAccel}{" "}
          accels) are combined with these context-aware weights.
        </li>
      </ul>
    </div>
  );
}

function ScoreComparisonCalculator() {
  const [drivingData, setDrivingData] = useState({
    harshBrakes: 2,
    harshAccel: 1,
    overspeedPercent: 0.15,
    nightDrivingPercent: 0.2,
    borough: "Manhattan",
    roadType: "urban",
    trafficDensity: 2,
  });

  const baselineScore = useMemo(() => {
    return computeBaselineScore(drivingData);
  }, [drivingData]);

  const dynamicScore = useMemo(() => {
    return computeSafetyScore(drivingData);
  }, [drivingData]);

  const scoreDifference = dynamicScore - baselineScore;
  const isPositive = scoreDifference > 0;
  const isEqual = scoreDifference === 0;

  // Calculate risk values for penalty detection
  const brakeRisk = Math.min((drivingData.harshBrakes || 0) / 4, 1);
  const accelRisk = Math.min((drivingData.harshAccel || 0) / 4, 1);
  const overspeedRisk = Math.min(Math.max(drivingData.overspeedPercent || 0, 0), 1);
  const nightRisk = Math.min(Math.max(drivingData.nightDrivingPercent || 0, 0), 1);

  const isSevere = isSeverelyBadDriving(drivingData);
  const ruralPenalty = getRuralPenaltyMultiplier(
    drivingData.roadType,
    brakeRisk,
    overspeedRisk,
    nightRisk,
    accelRisk
  );
  const hasRuralPenalty = drivingData.roadType === "rural" && ruralPenalty > 1.0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Urban Drive Aware</h1>
        {/* <p>
          Context-aware safe-driving score that adapts to{" "}
          <strong>urban vs rural</strong> context and{" "}
          <strong>traffic density</strong>. Enter your driving data below to see
          how context-aware weighting affects your safety score compared to a
          simple baseline.
        </p> */}
      </header>

      <div className="comparison-container">

      <div className="comparison-layout">
        <div className="input-panel">
          <div className="card input-card">
            <h2>Driving Data Input</h2>

            <div className="input-group">
              <label>
                <span className="input-label">Borough</span>
                <select
                  value={drivingData.borough}
                  onChange={(e) =>
                    setDrivingData({ ...drivingData, borough: e.target.value })
                  }
                >
                  <option value="Manhattan">Manhattan</option>
                  <option value="Brooklyn">Brooklyn</option>
                  <option value="Queens">Queens</option>
                  <option value="Bronx">Bronx</option>
                  <option value="Staten Island">Staten Island</option>
                </select>
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="input-label">Road Type</span>
                <select
                  value={drivingData.roadType}
                  onChange={(e) =>
                    setDrivingData({ ...drivingData, roadType: e.target.value })
                  }
                >
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                </select>
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="input-label">Traffic Density</span>
                <select
                  value={drivingData.trafficDensity}
                  onChange={(e) =>
                    setDrivingData({
                      ...drivingData,
                      trafficDensity: Number(e.target.value),
                    })
                  }
                >
                  <option value="1">Low (1)</option>
                  <option value="2">Medium (2)</option>
                  <option value="3">High (3)</option>
                </select>
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="input-label">
                  Harsh Brakes: {drivingData.harshBrakes}
                </span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={drivingData.harshBrakes}
                  onChange={(e) =>
                    setDrivingData({
                      ...drivingData,
                      harshBrakes: Number(e.target.value),
                    })
                  }
                />
                <div className="range-labels">
                  <span>0</span>
                  <span>10</span>
                </div>
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="input-label">
                  Harsh Accelerations: {drivingData.harshAccel}
                </span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={drivingData.harshAccel}
                  onChange={(e) =>
                    setDrivingData({
                      ...drivingData,
                      harshAccel: Number(e.target.value),
                    })
                  }
                />
                <div className="range-labels">
                  <span>0</span>
                  <span>10</span>
                </div>
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="input-label">
                  Overspeed Percentage: {Math.round(drivingData.overspeedPercent * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={drivingData.overspeedPercent * 100}
                  onChange={(e) =>
                    setDrivingData({
                      ...drivingData,
                      overspeedPercent: Number(e.target.value) / 100,
                    })
                  }
                />
                <div className="range-labels">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </label>
            </div>

            <div className="input-group">
              <label>
                <span className="input-label">
                  Night Driving Percentage: {Math.round(drivingData.nightDrivingPercent * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={drivingData.nightDrivingPercent * 100}
                  onChange={(e) =>
                    setDrivingData({
                      ...drivingData,
                      nightDrivingPercent: Number(e.target.value) / 100,
                    })
                  }
                />
                <div className="range-labels">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="score-comparison-panel">
          <div className="score-comparison-card">
            <h2>Score Comparison</h2>

            <div className="score-comparison-grid">
              <div className="score-display baseline-score">
                <div className="score-label">Baseline Score</div>
                <div className="score-value-large">{baselineScore}</div>
                <div className="score-description">
                  Simple scoring with fixed weights
                </div>
              </div>

              <div className="score-arrow">→</div>

              <div
                className={`score-display dynamic-score ${
                  isPositive ? "positive" : "negative"
                }`}
              >
                <div className="score-label">Dynamic Score</div>
                <div className="score-value-large">{dynamicScore}</div>
                <div className="score-description">
                  Context-aware weighting
                </div>
              </div>
            </div>

            {!isEqual && (
              <div
                className={`score-difference ${isPositive ? "positive" : "negative"}`}
              >
                <div className="difference-label">
                  {isPositive ? "↑ Improvement" : "↓ Penalty"}
                </div>
                <div className="difference-value">
                  {isPositive ? "+" : ""}
                  {scoreDifference} points
                </div>
                <div className="difference-explanation">
                  {isPositive
                    ? "Your score improved due to context-aware weighting"
                    : "Your score decreased due to stricter context-aware weighting"}
                </div>
              </div>
            )}
            {isEqual && (
              <div className="score-difference neutral">
                <div className="difference-label">Scores Match</div>
                <div className="difference-value">0 points</div>
                <div className="difference-explanation">
                  Your baseline and dynamic scores are the same
                </div>
              </div>
            )}

            <div className="weight-breakdown">
              <h3>Weight Breakdown</h3>
              <div className="weight-info">
                <p className="small">
                  <strong>Borough:</strong> {drivingData.borough} •{" "}
                  <strong>Road Type:</strong> {drivingData.roadType} •{" "}
                  <strong>Traffic Density:</strong> {drivingData.trafficDensity}
                </p>
                <p className="small">
                  The dynamic scoring adjusts weights based on your context. In{" "}
                  {drivingData.borough} with {drivingData.roadType} roads and{" "}
                  {drivingData.trafficDensity === 1
                    ? "low"
                    : drivingData.trafficDensity === 2
                    ? "medium"
                    : "high"}{" "}
                  traffic, certain behaviors are weighted differently than the
                  baseline.
                </p>
                
                {hasRuralPenalty && (
                  <div className="penalty-warning rural-penalty">
                    <strong>⚠️ Rural Area Penalty Applied:</strong> Bad driving in rural areas
                    receives harsher penalties. Your risk score has been multiplied by{" "}
                    {ruralPenalty.toFixed(2)}x due to poor driving behavior in a rural context.
                  </div>
                )}
                
                {isSevere && (
                  <div className="penalty-warning severe-penalty">
                    <strong>🚨 Severe Driving Penalty Applied:</strong> Your driving behavior
                    exceeds safety thresholds (e.g., {drivingData.harshBrakes >= 6 ? `${drivingData.harshBrakes} harsh brakes, ` : ""}
                    {drivingData.overspeedPercent > 0.5 ? `${Math.round(drivingData.overspeedPercent * 100)}% overspeeding, ` : ""}
                    {drivingData.harshAccel >= 6 ? `${drivingData.harshAccel} harsh accelerations` : ""}).
                    An additional severe penalty has been applied regardless of location.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default App;
