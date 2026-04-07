import type { StudentConfig, StudentOptions } from "../types/schemas.ts";

/**
 * Renders an HTML overlay prompting for grade + interest,
 * resolves with the chosen StudentConfig once the user submits.
 */
export function showStudentSetup(
  container: HTMLElement,
  options: StudentOptions,
): Promise<StudentConfig> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "student-setup";

    const gradeDefault = options.grade.default;

    overlay.innerHTML = `
      <div class="setup-card">
        <h1 class="setup-title">Riverwise</h1>
        <p class="setup-subtitle">Personalise your learning experience</p>

        <label class="setup-label" for="grade-slider">What grade are you in?</label>
        <div class="slider-row">
          <span class="slider-bound">${options.grade.min}</span>
          <input
            id="grade-slider"
            type="range"
            min="${options.grade.min}"
            max="${options.grade.max}"
            value="${gradeDefault}"
          />
          <span class="slider-bound">${options.grade.max}</span>
        </div>
        <span id="grade-value" class="grade-value">Grade ${gradeDefault}</span>

        <label class="setup-label" for="interest-select">What interests you?</label>
        <select id="interest-select">
          ${options.interests.map((i) => `<option value="${i}">${i}</option>`).join("")}
        </select>

        <button id="setup-start" type="button">Start Exploring</button>
      </div>
    `;

    container.appendChild(overlay);

    const slider = overlay.querySelector<HTMLInputElement>("#grade-slider")!;
    const gradeLabel = overlay.querySelector<HTMLSpanElement>("#grade-value")!;
    const select = overlay.querySelector<HTMLSelectElement>("#interest-select")!;
    const startBtn = overlay.querySelector<HTMLButtonElement>("#setup-start")!;

    slider.addEventListener("input", () => {
      gradeLabel.textContent = `Grade ${slider.value}`;
    });

    startBtn.addEventListener("click", () => {
      const config: StudentConfig = {
        grade_level: slider.value,
        interest: select.value,
      };
      overlay.classList.add("fade-out");
      overlay.addEventListener("animationend", () => {
        overlay.remove();
        resolve(config);
      });
    });
  });
}
