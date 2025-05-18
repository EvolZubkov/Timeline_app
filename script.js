window.onload = () => {
    generateSteps(5);

    handleFileInput("iconStageInput", "stage");
    handleFileInput("iconTestInput", "test");
    handleFileInput("iconDoneInput", "done");
    handleFileInput("iconFinalInput", "final");

    // Показывать имя файла
    function bindFileInputDisplay(fileInputId) {
        const fileInput = document.getElementById(fileInputId);
        const display = fileInput.closest('.file-row').querySelector('.file-name-display');

        fileInput.addEventListener('change', () => {
            const fileName = fileInput.files[0]?.name || 'Файл не выбран';
            display.value = fileName;
        });
    }

    ['iconStageInput', 'iconTestInput', 'iconDoneInput', 'iconFinalInput'].forEach(bindFileInputDisplay);

    // Автообновление цвета визуального кружка при выборе цвета
    function bindColorPicker(inputId) {
        const input = document.getElementById(inputId);
        const circle = input.parentElement;

        input.addEventListener('input', () => {
            circle.style.backgroundColor = input.value;

            if (inputId === 'lineColorInput') {
                const path = document.getElementById("timelinePath");
                if (path) path.setAttribute("stroke", input.value);
            }

            if (inputId === 'stepColorInput') {
                const steps = document.querySelectorAll(".step");
                steps.forEach(step => {
                    step.style.backgroundColor = input.value;
                });
            }

            if (inputId === 'ballColorInput') {
                const ball = document.getElementById("movingBall");
                ball.style.backgroundColor = input.value;
                ball.style.boxShadow = `
                0 0 20px ${input.value},
                0 0 60px ${input.value},
                0 0 140px ${input.value}
            `;
            }
        });
    }

    ['lineColorInput', 'stepColorInput', 'ballColorInput'].forEach(bindColorPicker);


};



const customIcons = {
    stage: null,
    test: null,
    done: null,
    final: null
};


let stepPoints = [];
let labelOffsets = {}; // Смещения подписей от центра шага
let draggedStep = null;
let draggedLabel = null;
let startX = 0, startY = 0;

let currentStep = null;
let animationTimeout = null;
let currentLineColor = "#770077"; // дефолтное значение


function handleFileInput(inputId, key) {
    const input = document.getElementById(inputId);
    input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                customIcons[key] = reader.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

handleFileInput("iconStageInput", "stage");
handleFileInput("iconTestInput", "test");
handleFileInput("iconDoneInput", "done");
handleFileInput("iconFinalInput", "final");


function generateSteps(count) {
    const container = document.querySelector(".timeline-container");
    const sidebar = document.querySelector(".sidebar");
    const fullWidth = window.innerWidth;
    const sidebarWidth = sidebar?.offsetWidth || 0;
    const width = fullWidth - sidebarWidth;

    const height = container.clientHeight;

    const padding = 120;
    const stepDiameter = 20;
    const usableWidth = width - 2 * padding - stepDiameter;
    const denominator = Math.max(1, count - 1);

    stepPoints = Array.from({ length: count }, (_, i) => ({
        x: padding + stepDiameter / 2 + (i * usableWidth) / denominator,
        y: height / 2
    }));

    // Очистить всё
    container.querySelectorAll(".step").forEach(el => el.remove());
    document.querySelectorAll(".step-icon").forEach(el => el.remove());
    document.querySelectorAll(".step-label").forEach(el => el.remove());
    document.getElementById("timelineSVG").innerHTML = "";

    // Устанавливаем шарик в начальную позицию
    currentStep = 0;
    const moving = document.getElementById("movingBall");
    const pt = stepPoints[0];
    moving.style.left = pt.x + "px";
    moving.style.top = pt.y + "px";


    stepPoints.forEach((pt, index) => {
        const step = document.createElement("div");
        step.classList.add("step");
        step.style.left = pt.x + "px";
        step.style.top = pt.y + "px";
        step.dataset.index = index;
        container.appendChild(step);

        const icon = document.createElement("img");
        icon.src = customIcons.stage || "icons/default.png";
        icon.classList.add("step-icon");
        icon.style.left = (container.offsetLeft + pt.x) + "px";
        icon.style.top = (container.offsetTop + pt.y) + "px";
        icon.dataset.index = index;
        document.body.appendChild(icon);

        // Начальное смещение подписи
        labelOffsets[index] = { dx: 0, dy: 40 };

        const label = document.createElement("div");
        label.classList.add("step-label");
        label.textContent = `Шаг ${index + 1}`;
        label.style.left = (container.offsetLeft + pt.x + labelOffsets[index].dx) + "px";
        label.style.top = (container.offsetTop + pt.y + labelOffsets[index].dy) + "px";
        label.dataset.index = index;
        label.draggable = false;
        document.body.appendChild(label);

        // Двойной клик для редактирования
        label.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            const input = document.createElement("textarea");
            input.value = label.innerText.replace(/<br\s*\/?>/g, "\n");
            input.className = "label-editor";
            input.rows = 3;
            document.body.appendChild(input);

            input.style.left = label.style.left;
            input.style.top = label.style.top;
            input.focus();

            function saveAndRemove() {
                const text = input.value;
                label.innerHTML = text.replace(/\n/g, "<br>");
                input.remove();

                const lower = text.toLowerCase();
                const index = parseInt(label.dataset.index);
                const icon = document.querySelector(`img.step-icon[data-index="${index}"]`);

                if (icon) {
                    if (lower.includes("тест") || lower.includes("сертиф")) {
                        icon.src = customIcons.test || "icons/test.png";
                    } else {
                        icon.src = customIcons.stage || "icons/default.png";
                    }
                }
            }


            input.addEventListener("blur", saveAndRemove);
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault(); // ⛔️ чтобы не добавлялся \n
                    saveAndRemove();
                }
            });
        });
    });

    // Обновляем координаты точек
    const steps = document.querySelectorAll(".step");
    steps.forEach((step, index) => {
        const rect = step.getBoundingClientRect();
        const containerRect = document.querySelector(".timeline-container").getBoundingClientRect();
        const x = rect.left + rect.width / 2 - containerRect.left;
        const y = rect.top + rect.height / 2 - containerRect.top;
        stepPoints[index] = { x, y };
    });

    drawPathFromSteps();
    // animateBall();
}

function buildSmoothPath(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;

    return d;
}

function drawPathFromSteps() {
    const pathSVG = document.getElementById("timelineSVG");
    pathSVG.innerHTML = "";

    const d = buildSmoothPath(stepPoints);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute("d", d);
    path.setAttribute("id", "timelinePath");
    path.setAttribute("stroke", currentLineColor);
    path.setAttribute("stroke-width", "20");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    pathSVG.appendChild(path);
}

function animateBall() {
    clearTimeout(animationTimeout);
    const moving = document.getElementById("movingBall");

    function move() {
        if (currentStep >= stepPoints.length) return;

        const pt = stepPoints[currentStep];
        moving.style.left = pt.x + "px";
        moving.style.top = pt.y + "px";

        if (currentStep > 0) {
            const icon = document.querySelector(`img.step-icon[data-index="${currentStep - 1}"]`);
            if (icon) icon.src = customIcons.done || "icons/done.png";
        }

        currentStep++;
        if (currentStep < stepPoints.length) {
            animationTimeout = setTimeout(move, 2800);
        } else {
            // ✅ Через 3 секунды завершить последний шаг
            const lastIcon = document.querySelector(`img.step-icon[data-index="${stepPoints.length - 1}"]`);
            if (lastIcon) {
                setTimeout(() => {
                    lastIcon.src = customIcons.final || "icons/fin.png";
                }, 3000);
            }
        }
    }

    move();
}

function restartBallAnimation() {
    clearTimeout(animationTimeout);
    currentStep = 0;
    animateBall();
}

// --- События мыши ---

document.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("step")) {
        draggedStep = e.target;
    } else if (e.target.classList.contains("step-label")) {
        draggedLabel = e.target;
        startX = e.clientX;
        startY = e.clientY;
    }
});

document.addEventListener("mousemove", (e) => {
    const containerRect = document.querySelector(".timeline-container").getBoundingClientRect();

    if (draggedStep) {
        const index = parseInt(draggedStep.dataset.index);
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;

        draggedStep.style.left = x + "px";
        draggedStep.style.top = y + "px";

        const icon = document.querySelector(`img.step-icon[data-index="${index}"]`);
        const stepRect = draggedStep.getBoundingClientRect();
        const centerX = stepRect.left + stepRect.width / 2 + window.scrollX;
        const centerY = stepRect.top + stepRect.height / 2 + window.scrollY;

        icon.style.left = `${centerX}px`;
        icon.style.top = `${centerY}px`;


        const label = document.querySelector(`.step-label[data-index="${index}"]`);
        const offset = labelOffsets[index] || { dx: 0, dy: 40 };
        label.style.left = (containerRect.left + x + offset.dx) + "px";
        label.style.top = (containerRect.top + y + offset.dy) + "px";

        const steps = document.querySelectorAll(".step");
        steps.forEach((step, i) => {
            const rect = step.getBoundingClientRect();
            const x = rect.left + rect.width / 2 - containerRect.left;
            const y = rect.top + rect.height / 2 - containerRect.top;
            stepPoints[i] = { x, y };
        });

        drawPathFromSteps();
        // restartBallAnimation();
    }

    if (draggedLabel) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const index = parseInt(draggedLabel.dataset.index);
        const step = document.querySelector(`.step[data-index="${index}"]`);
        const stepRect = step.getBoundingClientRect();
        const stepX = stepRect.left + stepRect.width / 2;
        const stepY = stepRect.top + stepRect.height / 2;

        const newLeft = draggedLabel.offsetLeft + dx;
        const newTop = draggedLabel.offsetTop + dy;

        draggedLabel.style.left = `${newLeft}px`;
        draggedLabel.style.top = `${newTop}px`;

        labelOffsets[index] = {
            dx: newLeft - stepX,
            dy: newTop - stepY
        };

        startX = e.clientX;
        startY = e.clientY;
    }
});

document.addEventListener("mouseup", () => {
    draggedStep = null;
    draggedLabel = null;
});

document.getElementById("applyStepsBtn").addEventListener("click", () => {
    const count = parseInt(document.getElementById("stepCountInput").value, 10);
    if (!isNaN(count) && count > 0 && count <= 50) {
        generateSteps(count);
    }
});

document.getElementById("startAnimationBtn").addEventListener("click", () => {
    restartBallAnimation();
});
document.getElementById("resetBtn").addEventListener("click", () => {
    location.reload();
});

document.getElementById("animateToStepBtn").addEventListener("click", () => {
    const input = document.getElementById("goToStepInput");
    let target = parseInt(input.value, 10);

    if (isNaN(target) || target < 2 || target > stepPoints.length) return;

    const fromIndex = target - 2;
    const toIndex = target - 1;

    const moving = document.getElementById("movingBall");

    // ✅ Устанавливаем все предыдущие иконки как "done"
    for (let i = 0; i < fromIndex; i++) {
        const icon = document.querySelector(`img.step-icon[data-index="${i}"]`);
        if (icon) {
            icon.src = customIcons.done || "icons/done.png";
        }
    }

    // ✅ Устанавливаем шарик на fromIndex
    const fromPoint = stepPoints[fromIndex];
    moving.style.left = fromPoint.x + "px";
    moving.style.top = fromPoint.y + "px";
    currentStep = fromIndex;

    // ✅ Через 3 секунды — движение на toIndex и done для fromIndex
    setTimeout(() => {
        const prevIcon = document.querySelector(`img.step-icon[data-index="${fromIndex}"]`);
        if (prevIcon) {
            prevIcon.src = customIcons.done || "icons/done.png";
        }

        const toPoint = stepPoints[toIndex];
        moving.style.left = toPoint.x + "px";
        moving.style.top = toPoint.y + "px";

        currentStep = toIndex;
    }, 3000);
});
document.getElementById("resetAnimationBtn").addEventListener("click", () => {
    const moving = document.getElementById("movingBall");

    // 1. Остановить любую активную анимацию
    clearTimeout(animationTimeout);
    animationTimeout = null;

    // 2. Вернуть шарик на шаг 1
    if (stepPoints.length > 0) {
        const pt = stepPoints[0];
        moving.style.left = pt.x + "px";
        moving.style.top = pt.y + "px";
        currentStep = 0;
    }

    // 3. Сбросить иконки, кроме "test"
    const labels = document.querySelectorAll(".step-label");
    const icons = document.querySelectorAll("img.step-icon");

    icons.forEach((icon, index) => {
        const label = labels[index];
        const text = label?.innerText.toLowerCase();

        if (text?.includes("тест") || text?.includes("сертиф")) {
            icon.src = customIcons.test || "icons/test.png";
        } else {
            icon.src = customIcons.stage || "icons/default.png";
        }
    });
});

document.getElementById("recordAnimationBtn").addEventListener("click", async () => {
    const target = document.getElementById("animationArea");
    document.getElementById("animationArea").classList.add("blurred");
    document.querySelector(".timeline-container").classList.add("blurred");

    infoTrigger.addEventListener("click", () => {
        infoOverlay.classList.add("active");
        animationArea.classList.add("blurred");
    });

    infoClose.addEventListener("click", () => {
        infoOverlay.classList.remove("active");
        animationArea.classList.remove("blurred");
    });

    infoOverlay.addEventListener("click", (e) => {
        if (e.target === infoOverlay) {
            infoOverlay.classList.remove("active");
            animationArea.classList.remove("blurred");
        }
    });

    if (!target.captureStream) {
        alert("Ваш браузер не поддерживает запись с DOM (captureStream). Используйте Chrome.");
        return;
    }

    const stream = target.captureStream(30); // FPS
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

    const chunks = [];

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            chunks.push(e.data);
        }
    };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "animation.webm";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    recorder.start();

    // Запись 6 секунд (или сколько длится анимация)
    setTimeout(() => recorder.stop(), 6000);
});
document.getElementById("lineColorInput").addEventListener("input", (e) => {
    currentLineColor = e.target.value;
    const path = document.getElementById("timelinePath");
    if (path) path.setAttribute("stroke", currentLineColor);
});
const infoTrigger = document.getElementById("infoTrigger");
const infoOverlay = document.getElementById("infoOverlay");
const infoClose = document.getElementById("infoClose");

infoTrigger.addEventListener("click", () => {
    infoOverlay.classList.add("active");
});
infoClose.addEventListener("click", () => {
    infoOverlay.classList.remove("active");
});
infoOverlay.addEventListener("click", (e) => {
    if (e.target === infoOverlay) {
        infoOverlay.classList.remove("active");
    }
});
