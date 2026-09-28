const STORAGE_KEY = 'GO_WELLNESS_APP_DATA_V3_3';

// Credenciais do Supabase (Verifique se o URL do projeto está exatamente correto no painel do Supabase)
const SUPABASE_URL = 'https://hjasprgfbfuhqsqyoole.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XKW3jAwAWsdzqK-rx6XzgQ_MTpQycvA';

let supabaseClientInstance = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("A biblioteca do Supabase CDN não foi carregada corretamente.");
    }
} catch (e) {
    console.error("Erro ao inicializar o cliente Supabase:", e);
}

const diasSemanaMap = {
    0: 'Domingo',
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado'
};

async function testarSupabase() {
    if (!supabaseClientInstance) {
        console.error("❌ Cliente Supabase não inicializado.");
        return;
    }
    console.log("A testar conexão com o Supabase...");
    const { data, error } = await supabaseClientInstance.from('alunos').select('*').limit(1);
    if (error) {
        console.error("❌ Erro na conexão:", error.message);
    } else {
        console.log("✅ Conexão bem-sucedida! Dados encontrados:", data);
    }
}
testarSupabase();

function formatDateToKey(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateForWeekday(targetWeekday, baseDate = new Date()) {
    const d = new Date(baseDate);
    const currentDay = d.getDay();
    let distance = targetWeekday - currentDay;
    if (distance < 0) {
        distance += 7;
    }
    d.setDate(d.getDate() + distance);
    return formatDateToKey(d);
}

function getDefaultData() {
    return {
        personal: {
            nome: "Go Wellness Engine",
            titulo: "Studio & Performance"
        },
        alunos: [],
        treinos: []
    };
}

let appData = null;
let currentDateSelected = formatDateToKey(new Date());
let currentCalendarDate = new Date();
let selectedStudentIdForDay = null;
let currentEditingAlunoId = null;

// Inicialização e Carregamento
window.addEventListener('DOMContentLoaded', () => {
    loadAppData();
});

async function loadAppData() {
    try {
        // Busca alunos
        const { data: alunosData, error: alunosError } = await supabaseClientInstance
            .from('alunos')
            .select('*');

        if (alunosError) throw alunosError;

        // Busca treinos diretamente da tabela 'treinos'
        const { data: treinosData, error: treinosError } = await supabaseClientInstance
            .from('treinos')
            .select('*');

        if (treinosError) throw treinosError;

        appData = {
            personal: {
                nome: "Go Wellness Engine",
                titulo: "Studio & Performance"
            },
            alunos: alunosData || [],
            treinos: treinosData || []
        };

    } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err.message);
        showToast("Erro ao sincronizar com o Supabase.", "error");
        appData = getDefaultData();
    }
    renderAll();
}

async function persistirTreinosAlunoNoSupabase(alunoId) {
    // Filtra todos os treinos pertencentes a este aluno na memória
    const treinosDoAluno = appData.treinos.filter(t => t.alunoId === alunoId);
    
    // Como a tabela 'treinos' é relacional, salvamos cada treino dela no Supabase
    for (const treino of treinosDoAluno) {
        const { error } = await supabaseClientInstance
            .from('treinos')
            .upsert({
                id: treino.id,
                alunoId: treino.alunoId,
                data: treino.data,
                horario: treino.horario,
                tipo: treino.tipo,
                concluido: treino.concluido,
                exercicios: treino.exercicios
            });

        if (error) {
            console.error("Erro ao salvar treino no Supabase:", error.message);
            showToast("Erro ao sincronizar treino com o banco.", "error");
        }
    }
}

async function saveAppData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (err) {
        console.error("Erro ao salvar dados:", err);
        showToast("Erro ao salvar os dados no navegador.", "error");
    }
}

function resetToDefaultData() {
    if (confirm("Restaurar dados padrão do Go Wellness?")) {
        appData = getDefaultData();
        saveAppData();
        renderAll();
        showToast("Dados restaurados com sucesso!", "success");
    }
}

function switchTab(tabId) {
    const tabDashboard = document.getElementById('tab-dashboard');
    const tabAlunos = document.getElementById('tab-alunos');
    const navDashboard = document.getElementById('nav-dashboard');
    const navAlunos = document.getElementById('nav-alunos');

    if (tabId === 'dashboard') {
        tabDashboard.classList.remove('hidden');
        tabAlunos.classList.add('hidden');
        navDashboard.classList.add('active', 'bg-slate-100', 'text-slate-900');
        navAlunos.classList.remove('active', 'bg-slate-100', 'text-slate-900');
    } else {
        tabAlunos.classList.remove('hidden');
        tabDashboard.classList.add('hidden');
        navAlunos.classList.add('active', 'bg-slate-100', 'text-slate-900');
        navDashboard.classList.remove('active', 'bg-slate-100', 'text-slate-900');
    }
}

function getLastUsedWeightForExercise(studentId, exerciseName) {
    if (!exerciseName || !studentId) return null;
    const cleanTarget = exerciseName.trim().toLowerCase();
    const studentWorkouts = appData.treinos
        .filter(t => t.alunoId === studentId)
        .sort((a, b) => b.data.localeCompare(a.data));

    for (const workout of studentWorkouts) {
        for (const ex of workout.exercicios) {
            if (ex.nome.trim().toLowerCase() === cleanTarget && ex.cargaKg !== undefined && ex.cargaKg !== null) {
                return { cargaKg: ex.cargaKg, data: workout.data };
            }
        }
    }
    return null;
}

function exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `GoWellness_Backup_${formatDateToKey(new Date())}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast("Backup exportado com sucesso!", "success");
}

function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && imported.alunos && imported.treinos) {
                appData = imported;
                await saveAppData();
                renderAll();
                showToast("Backup importado com sucesso!", "success");
            } else {
                showToast("Estrutura do arquivo JSON inválida.", "error");
            }
        } catch (err) {
            showToast("Erro ao processar arquivo JSON.", "error");
        }
    };
    reader.readAsText(file);
}

function toggleSidebar() {
    const drawer = document.getElementById('sidebarDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const isHidden = drawer.classList.contains('-translate-x-full');
    if (isHidden) {
        drawer.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
    } else {
        drawer.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    }
}

function goToToday() {
    currentCalendarDate = new Date();
    currentDateSelected = formatDateToKey(new Date());
    selectedStudentIdForDay = null;
    closeModal('modalCalendario');
    renderAll();
}

function renderAll() {
    renderDateBar();
    renderCalendarGrid();
    renderStudentHeaderTabs();
    renderSelectedStudentWorkout();
    renderAlunos();
    updateAlunoSelectDropdown();
}

function renderDateBar() {
    const display = document.getElementById('displaySelectedDate');
    const todayStr = formatDateToKey(new Date());
    const [year, month, day] = currentDateSelected.split('-');
    const dateObj = new Date(year, month - 1, day);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    let formatted = dateObj.toLocaleDateString('pt-BR', options);
    if (currentDateSelected === todayStr) {
        formatted = `Hoje (${formatted})`;
    }
    display.innerText = formatted;
}

function renderCalendarGrid() {
    const monthLabel = document.getElementById('calendarMonthLabel');
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    monthLabel.innerText = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDateToKey(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayWorkouts = appData.treinos.filter(t => t.data === dateKey);
        const hasWorkouts = dayWorkouts.length > 0;
        const allCompleted = hasWorkouts && dayWorkouts.every(t => t.concluido);
        const isSelected = dateKey === currentDateSelected;
        const isToday = dateKey === todayStr;

        const dayBtn = document.createElement('button');
        dayBtn.onclick = () => {
            currentDateSelected = dateKey;
            selectedStudentIdForDay = null;
            closeModal('modalCalendario');
            renderAll();
        };

        let btnClasses = "h-10 rounded-xl flex flex-col items-center justify-center relative font-semibold text-xs border transition ";
        if (isSelected) {
            btnClasses += "bg-emerald-600 text-white border-emerald-600 font-bold shadow-md shadow-emerald-600/20";
        } else if (isToday) {
            btnClasses += "bg-emerald-50 text-emerald-700 border-emerald-300";
        } else {
            btnClasses += "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";
        }
        dayBtn.className = btnClasses;
        dayBtn.innerText = day;

        if (hasWorkouts) {
            const dot = document.createElement('span');
            const dotColor = allCompleted ? "bg-emerald-500" : "bg-amber-500";
            dot.className = `w-1.5 h-1.5 rounded-full ${dotColor} absolute bottom-1 ${isSelected ? 'bg-white' : ''}`;
            dayBtn.appendChild(dot);
        }
        grid.appendChild(dayBtn);
    }
}

function changeCalendarMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendarGrid();
}

function renderStudentHeaderTabs() {
    const tabsContainer = document.getElementById('studentsHeaderTabs');
    const badge = document.getElementById('studentsCountBadge');
    const dayWorkouts = appData.treinos.filter(t => t.data === currentDateSelected);
    badge.innerText = `${dayWorkouts.length} Aluno${dayWorkouts.length !== 1 ? 's' : ''}`;

    if (dayWorkouts.length === 0) {
        tabsContainer.innerHTML = `<div class="text-xs text-slate-400 py-1 italic">Nenhum treino agendado para esta data.</div>`;
        return;
    }

    if (!selectedStudentIdForDay || !dayWorkouts.some(w => w.alunoId === selectedStudentIdForDay)) {
        selectedStudentIdForDay = dayWorkouts[0].alunoId;
    }

    tabsContainer.innerHTML = dayWorkouts.map(workout => {
        const aluno = appData.alunos.find(a => a.id === workout.alunoId) || { nome: "Aluno", foto: "" };
        const isSelected = workout.alunoId === selectedStudentIdForDay;
        const isCompleted = workout.concluido;

        return `
            <button onclick="selectStudentTab('${workout.alunoId}')" class="flex items-center space-x-2.5 px-3.5 py-2 rounded-xl border transition shrink-0 ${
                isSelected 
                ? 'bg-white border-emerald-500 text-slate-900 shadow-md shadow-emerald-500/10' 
                : 'bg-white/60 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white'
            }">
                <div class="relative">
                    <img src="${aluno.foto}" alt="${aluno.nome}" class="w-8 h-8 rounded-lg object-cover border border-slate-200">
                    <span class="w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'} absolute -top-1 -right-1 border border-white"></span>
                </div>
                <div class="text-left">
                    <div class="text-xs font-bold leading-tight">${aluno.nome}</div>
                    <div class="text-[10px] text-slate-400 font-mono">${workout.horario}</div>
                </div>
            </button>
        `;
    }).join('');
}

function selectStudentTab(alunoId) {
    selectedStudentIdForDay = alunoId;
    renderStudentHeaderTabs();
    renderSelectedStudentWorkout();
}

function renderSelectedStudentWorkout() {
    const container = document.getElementById('workoutDetailContent');
    const dayWorkouts = appData.treinos.filter(t => t.data === currentDateSelected);

    if (dayWorkouts.length === 0) {
        container.innerHTML = `
            <div class="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-300 rounded-2xl max-w-md mx-auto my-12 bg-white/50">
                <i class="fa-solid fa-dumbbell text-3xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 text-sm font-medium">Nenhum treino programado para este dia.</p>
                <button onclick="openModal('modalNovoTreino')" class="mt-4 text-xs bg-white hover:bg-slate-50 text-emerald-600 font-semibold px-4 py-2 rounded-xl transition border border-slate-200 shadow-sm">
                    + Agendar Sessão
                </button>
            </div>
        `;
        return;
    }

    const workout = dayWorkouts.find(w => w.alunoId === selectedStudentIdForDay) || dayWorkouts[0];
    const aluno = appData.alunos.find(a => a.id === workout.alunoId) || { nome: "Aluno", foto: "", objetivo: "", observacoes: "" };
    const isCompleted = workout.concluido;

    container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-5">
            <div class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div class="flex items-center space-x-3.5">
                    <img src="${aluno.foto}" alt="${aluno.nome}" class="w-14 h-14 rounded-2xl object-cover border border-slate-200">
                    <div>
                        <div class="flex items-center space-x-2">
                            <h3 class="font-bold text-slate-900 text-base sm:text-lg">${aluno.nome}</h3>
                            <span class="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">${workout.horario}</span>
                        </div>
                        <p class="text-xs text-emerald-600 font-semibold mt-0.5">${workout.tipo}</p>
                        ${aluno.observacoes ? `<p class="text-[11px] text-amber-600 mt-1 flex items-center space-x-1"><i class="fa-solid fa-triangle-exclamation"></i><span>${aluno.observacoes}</span></p>` : ''}
                    </div>
                </div>
                <div class="flex items-center space-x-2.5 self-end sm:self-center">
                    <button onclick="toggleWorkoutComplete('${workout.id}')" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${isCompleted ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'}">
                        <i class="fa-solid ${isCompleted ? 'fa-check' : 'fa-circle'}"></i>
                        <span>${isCompleted ? 'Concluído' : 'Marcar Concluído'}</span>
                    </button>
                    <button onclick="deletarTreino('${workout.id}')" class="text-slate-400 hover:text-red-500 p-2 transition">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>

            <div class="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
                <div class="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Exercícios (${workout.exercicios.length})</span>
                    <span class="text-[11px] text-slate-400 font-mono">Supabase Sync ativo</span>
                </div>
                
                <div class="space-y-2.5">
                    ${workout.exercicios.map(ex => {
                        const weightHistory = getLastUsedWeightForExercise(workout.alunoId, ex.nome);
                        return `
                            <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition">
                                <div class="flex items-start space-x-3">
                                    <input type="checkbox" ${ex.concluido ? 'checked' : ''} onchange="toggleExerciseCheck('${workout.id}', '${ex.id}')" class="mt-1 w-4 h-4 accent-emerald-600 rounded cursor-pointer">
                                    <div>
                                        <div class="flex items-center space-x-2">
                                            <span class="text-sm font-semibold ${ex.concluido ? 'line-through text-slate-400' : 'text-slate-800'}">${ex.nome}</span>${weightHistory ? `<span class="text-[10px] bg-white text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded font-mono" title="Último registro">Anterior: ${weightHistory.cargaKg}kg</span>` : ''}
                                        </div>
                                        <div class="text-xs text-slate-500 mt-0.5">${ex.series} séries × ${ex.reps}${ex.obs ? ' <span class="text-slate-400">(' + ex.obs + ')</span>' : ''}</div>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2.5 self-end sm:self-center">
                                    <span class="text-xs text-slate-500 font-semibold">Carga:</span>
                                    <div class="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                        <button onclick="updateCarga('${workout.id}', '${ex.id}', -2)" class="px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 active:text-slate-800 font-bold transition">-</button>
                                        <span class="px-2.5 text-xs font-bold font-mono text-emerald-600">${ex.cargaKg} kg</span>
                                        <button onclick="updateCarga('${workout.id}', '${ex.id}', 2)" class="px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 active:text-slate-800 font-bold transition">+</button>
                                    </div>
                                    <button onclick="removeExercicioFromWorkout('${workout.id}', '${ex.id}')" class="text-slate-400 hover:text-red-500 p-1.5 transition ml-1" title="Remover">
                                        <i class="fa-solid fa-xmark text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-center">
                    <button onclick="openModalAddExercicioRapido('${workout.id}', '${workout.alunoId}')" class="w-full sm:w-auto bg-slate-50 hover:bg-slate-100 border border-dashed border-emerald-500/40 text-emerald-600 hover:text-emerald-700 font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition shadow-sm">
                        <i class="fa-solid fa-plus-circle"></i>
                        <span>Adicionar Novo Exercício</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function toggleWorkoutComplete(workoutId) {
    const workout = appData.treinos.find(t => t.id === workoutId);
    if (workout) {
        workout.concluido = !workout.concluido;
        workout.exercicios.forEach(e => e.concluido = workout.concluido);
        await saveAppData();
        renderAll();
        showToast("Status do treino atualizado!", "success");
    }
}

async function toggleExerciseCheck(workoutId, exercicioId) {
    const workout = appData.treinos.find(t => t.id === workoutId);
    if (workout) {
        const ex = workout.exercicios.find(e => e.id === exercicioId);
        if (ex) {
            ex.concluido = !ex.concluido;
            workout.concluido = workout.exercicios.every(e => e.concluido);
            await saveAppData();
            renderAll();
        }
    }
}

async function updateCarga(workoutId, exercicioId, delta) {
    const workout = appData.treinos.find(t => t.id === workoutId);
    if (workout) {
        const ex = workout.exercicios.find(e => e.id === exercicioId);
        if (ex) {
            ex.cargaKg = Math.max(0, ex.cargaKg + delta);
            await saveAppData();
            renderSelectedStudentWorkout();
        }
    }
}

async function removeExercicioFromWorkout(workoutId, exercicioId) {
    const workout = appData.treinos.find(t => t.id === workoutId);
    if (workout && confirm("Deseja remover este exercício?")) {
        workout.exercicios = workout.exercicios.filter(e => e.id !== exercicioId);
        await saveAppData();
        renderSelectedStudentWorkout();
        showToast("Exercício removido com sucesso!", "success");
    }
}

function openModalAddExercicioRapido(workoutId, alunoId) {
    document.getElementById('rapidoWorkoutId').value = workoutId;
    document.getElementById('rapidoAlunoId').value = alunoId;
    document.getElementById('formAddExercicioRapido').reset();
    document.getElementById('rapidoHistoryBadge').classList.add('hidden');
    openModal('modalAddExercioRapido');
}

function autoCheckPreviousWeight(exerciseName) {
    const alunoId = document.getElementById('rapidoAlunoId').value;
    const historyBadge = document.getElementById('rapidoHistoryBadge');
    const historyText = document.getElementById('rapidoHistoryText');
    const cargaInput = document.getElementById('rapidoCarga');

    if (!exerciseName.trim()) {
        historyBadge.classList.add('hidden');
        return;
    }

    const history = getLastUsedWeightForExercise(alunoId, exerciseName);
    if (history) {
        cargaInput.value = history.cargaKg;
        historyText.innerText = `Carga anterior usada: ${history.cargaKg} kg`;
        historyBadge.classList.remove('hidden');
    } else {
        historyBadge.classList.add('hidden');
    }
}

async function handleSalvarExercicioRapido(event) {
    event.preventDefault();
    const workoutId = document.getElementById('rapidoWorkoutId').value;
    const nome = document.getElementById('rapidoNome').value;
    const series = parseInt(document.getElementById('rapidoSeries').value) || 3;
    const reps = document.getElementById('rapidoReps').value || "12";
    const cargaKg = parseFloat(document.getElementById('rapidoCarga').value) || 0;
    const obs = document.getElementById('rapidoObs').value || "";

    const workout = appData.treinos.find(t => t.id === workoutId);
    if (workout) {
        const novoExercicio = {
            id: 'e_' + Date.now(),
            nome,
            series,
            reps,
            cargaKg,
            concluido: false,
            obs
        };
        workout.exercicios.push(novoExercicio);
        await saveAppData();
        closeModal('modalAddExercioRapido');
        renderSelectedStudentWorkout();
        showToast("Exercício adicionado com sucesso!", "success");
    }
}

async function deletarTreino(workoutId) {
    if (confirm("Deseja excluir este treino?")) {
        appData.treinos = appData.treinos.filter(t => t.id !== workoutId);
        await saveAppData();
        renderAll();
        showToast("Treino excluído com sucesso!", "success");
    }
}

function renderAlunos() {
    const grid = document.getElementById('alunosGrid');
    grid.innerHTML = appData.alunos.map(aluno => {
        const totalTreinos = appData.treinos.filter(t => t.alunoId === aluno.id).length;
        const agendaHtml = aluno.agendaRecorrente && aluno.agendaRecorrente.length > 0
            ? aluno.agendaRecorrente.map(a => `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono">${diasSemanaMap[a.diaSemana]} ${a.horario}</span>`).join(' ')
            : '<span class="text-slate-400 italic text-[11px]">Nenhum horário fixo definido</span>';

        return `
            <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm hover:shadow-md transition">
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3.5">
                            <img src="${aluno.foto}" alt="${aluno.nome}" class="w-14 h-14 rounded-2xl object-cover border border-slate-200">
                            <div>
                                <h4 class="font-bold text-slate-900 text-base">${aluno.nome}</h4>
                                <span class="text-xs text-emerald-600 font-semibold">${aluno.objetivo}</span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-1">
                            <button onclick="openEditarAluno('${aluno.id}')" class="text-slate-400 hover:text-emerald-600 p-2 transition" title="Perfil & Gerir Treinos">
                                <i class="fa-solid fa-pen text-xs"></i>
                            </button>
                            <button onclick="deletarAluno('${aluno.id}')" class="text-slate-400 hover:text-red-500 p-2 transition" title="Excluir Aluno">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="space-y-1 pt-1">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agenda Recorrente:</div>
                        <div class="flex flex-wrap gap-1.5">${agendaHtml}</div>
                    </div>

                    ${aluno.observacoes ? `
                        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-amber-700 flex items-start space-x-2">
                            <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                            <span>${aluno.observacoes}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span class="font-mono">${totalTreinos} treinos vinculados</span>
                    <span class="text-emerald-600 font-semibold">Ativo</span>
                </div>
            </div>
        `;
    }).join('');
}

function toggleDiaHorarioInput(checkbox) {
    const diaVal = checkbox.value;
    const timeInput = document.getElementById(`horario_dia_${diaVal}`);
    if (timeInput) {
        timeInput.disabled = !checkbox.checked;
        if (checkbox.checked) timeInput.focus();
    }
}

function switchAlunoModalTab(tabName) {
    const btnInfo = document.getElementById('btnTabAlunoInfo');
    const btnTreinos = document.getElementById('btnTabAlunoTreinos');
    const contentInfo = document.getElementById('alunoTabInfoContent');
    const contentTreinos = document.getElementById('alunoTabTreinosContent');

    if (tabName === 'info') {
        btnInfo.className = "py-3 px-4 text-xs font-bold border-b-2 border-emerald-600 text-emerald-600 transition flex items-center space-x-2";
        btnTreinos.className = "py-3 px-4 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center space-x-2";
        contentInfo.classList.remove('hidden');
        contentTreinos.classList.add('hidden');
    } else {
        btnTreinos.className = "py-3 px-4 text-xs font-bold border-b-2 border-emerald-600 text-emerald-600 transition flex items-center space-x-2";
        btnInfo.className = "py-3 px-4 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center space-x-2";
        contentTreinos.classList.remove('hidden');
        contentInfo.classList.add('hidden');
        renderPerfilTreinosList();
        populatePerfilTreinosDiaSelect();
        if (document.getElementById('perfilExerciciosBuilderList').children.length === 0) {
            addExerciciosRow('perfilExerciciosBuilderList');
        }
    }
}

function openEditarAluno(alunoId) {
    const aluno = appData.alunos.find(a => a.id === alunoId);
    if (!aluno) return;
    currentEditingAlunoId = aluno.id;

    document.getElementById('modalAlunoNomeTitulo').innerText = aluno.nome;
    document.getElementById('editAlunoId').value = aluno.id;
    document.getElementById('editAlunoNome').value = aluno.nome;
    document.getElementById('editAlunoObjetivo').value = aluno.objetivo;
    document.getElementById('editAlunoObs').value = aluno.observacoes || '';
    document.getElementById('editAlunoFoto').value = aluno.foto || '';

    document.querySelectorAll('.dia-check').forEach(chk => {
        chk.checked = false;
        const timeInput = document.getElementById(`horario_dia_${chk.value}`);
        if (timeInput) {
            timeInput.disabled = true;
            timeInput.value = "08:00";
        }
    });

    if (aluno.agendaRecorrente && Array.isArray(aluno.agendaRecorrente)) {
        aluno.agendaRecorrente.forEach(item => {
            const chk = document.querySelector(`.dia-check[value="${item.diaSemana}"]`);
            const timeInput = document.getElementById(`horario_dia_${item.diaSemana}`);
            if (chk && timeInput) {
                chk.checked = true;
                timeInput.disabled = false;
                timeInput.value = item.horario || "08:00";
            }
        });
    }

    switchAlunoModalTab('info');
    openModal('modalEditarAluno');
}

async function handleSalvarEdicaoAlunoInfo(event) {
    event.preventDefault();
    const id = document.getElementById('editAlunoId').value;
    const nome = document.getElementById('editAlunoNome').value;
    const objetivo = document.getElementById('editAlunoObjetivo').value;
    const observacoes = document.getElementById('editAlunoObs').value;
    let foto = document.getElementById('editAlunoFoto').value;

    if (!foto) {
        foto = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
    }

    const agendaRecorrente = [];
    document.querySelectorAll('.dia-check').forEach(chk => {
        if (chk.checked) {
            const diaSemana = parseInt(chk.value);
            const timeInput = document.getElementById(`horario_dia_${diaSemana}`);
            const horario = timeInput ? timeInput.value : "08:00";
            agendaRecorrente.push({ diaSemana, horario });
        }
    });

    const aluno = appData.alunos.find(a => a.id === id);
    if (aluno) {
        aluno.nome = nome;
        aluno.objetivo = objetivo;
        aluno.observacoes = observacoes;
        aluno.foto = foto;
        aluno.agendaRecorrente = agendaRecorrente;
        await saveAppData();
        closeModal('modalEditarAluno');
        renderAll();
        showToast("Dados do aluno atualizados com sucesso!", "success");
    }
}

function renderPerfilTreinosList() {
    const container = document.getElementById('perfilTreinosListContainer');
    if (!container) return;
    const alunoTreinos = appData.treinos.filter(t => t.alunoId === currentEditingAlunoId).sort((a,b) => b.data.localeCompare(a.data));

    if (alunoTreinos.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Nenhum treino cadastrado para este aluno ainda.</p>`;
        return;
    }

    container.innerHTML = alunoTreinos.map(t => {
        const [ano, mes, dia] = t.data.split('-').map(Number);
        const dataObj = new Date(ano, mes - 1, dia);
        const diaSemanaNome = diasSemanaMap[dataObj.getDay()] || 'Dia não definido';

        return `
            <div onclick="abrirDetalhesTreinoHistorico('${t.id}')" class="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-xl p-3.5 flex items-center justify-between shadow-xs cursor-pointer transition mb-3">
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-bold text-slate-800">${t.tipo}</span>
                        <span class="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">${t.horario}</span>
                    </div>
                    <div class="text-[11px] text-slate-600 mt-1 space-y-0.5">
                        <p><strong>Dia da semana do treino:</strong> ${diaSemanaNome}</p>
                        <p><strong>Dia de cadastro:</strong> ${t.data}</p>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-1">${t.exercicios.length} exercício(s) programado(s)</div>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-emerald-600 font-semibold hidden sm:inline">Ver Detalhes</span>
                    <button onclick="event.stopPropagation(); deletarTreinoDoPerfil('${t.id}')" class="text-slate-400 hover:text-red-500 p-1.5 transition" title="Excluir treino">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function abrirDetalhesTreinoHistorico(workoutId) {
    const treino = appData.treinos.find(t => t.id === workoutId);
    if (!treino) return;

    const container = document.getElementById('corpoDetalhesTreinoHistorico');
    let html = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">${treino.tipo}</span>
                <span class="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">Data: ${treino.data} (${treino.horario})</span>
            </div>
            <p class="text-xs text-slate-500">Lista completa dos exercícios programados para esta sessão:</p>
        </div>
        <div class="space-y-2 pt-2">
    `;

    treino.exercicios.forEach((ex, idx) => {
        html += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <div class="text-xs font-bold text-slate-800">${idx + 1}. ${ex.nome}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5">
                        Séries: <span class="font-semibold text-slate-700">${ex.series}</span> | 
                        Repetições: <span class="font-semibold text-slate-700">${ex.reps}</span>
                        ${ex.obs ? `| Obs: <span class="text-slate-600">${ex.obs}</span>` : ''}
                    </div>
                </div>
                <div class="text-xs font-mono font-bold text-emerald-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg self-start sm:self-center shadow-xs">
                    Carga: ${ex.cargaKg} kg
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
    openModal('modalDetalhesTreinoHistorico');
}

function populatePerfilTreinosDiaSelect() {
    const select = document.getElementById('perfilTreinoDiaSemana');
    if (!select || !currentEditingAlunoId) return;
    const aluno = appData.alunos.find(a => a.id === currentEditingAlunoId);
    
    select.innerHTML = '<option value="" disabled selected>Selecione um dia ativo do aluno...</option>';
    if (aluno && aluno.agendaRecorrente && aluno.agendaRecorrente.length > 0) {
        aluno.agendaRecorrente.forEach(item => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ diaSemana: item.diaSemana, horario: item.horario });
            opt.textContent = `${diasSemanaMap[item.diaSemana]} (${item.horario})`;
            select.appendChild(opt);
        });
    } else {
        select.innerHTML = '<option value="" disabled selected>Nenhum dia ativo configurado no cadastro!</option>';
    }
}

async function handleSalvarTreinoDoPerfil(event) {
    event.preventDefault();
    if (!currentEditingAlunoId) return;

    const selectDiaVal = document.getElementById('perfilTreinoDiaSemana').value;
    if (!selectDiaVal) {
        showToast('Selecione um dia ativo válido.', 'error');
        return;
    }

    const agendaObj = JSON.parse(selectDiaVal);
    const dataCalculada = getDateForWeekday(agendaObj.diaSemana);
    const horario = agendaObj.horario;
    const tipo = document.getElementById('perfilTreinoTipo').value;
    const rows = document.querySelectorAll('#perfilExerciciosBuilderList .exercicio-linha');

    const exercicios = Array.from(rows).map((row, index) => ({
        id: 'e_' + Date.now() + index,
        nome: row.querySelector('.input-nome-ex').value,
        series: parseInt(row.querySelector('.input-series').value) || 3,
        reps: row.querySelector('.input-repeticoes').value || "12",
        cargaKg: parseFloat(row.querySelector('.input-carga').value) || 0,
        concluido: false,
        obs: ""
    }));

    const novoTreino = {
        id: 't_' + Date.now(),
        alunoId: currentEditingAlunoId,
        data: dataCalculada,
        horario,
        tipo,
        concluido: false,
        exercicios
    };

    appData.treinos.push(novoTreino);
    await persistirTreinosAlunoNoSupabase(currentEditingAlunoId);

    document.getElementById('formCriarTreinoNoPerfil').reset();
    document.getElementById('perfilExerciciosBuilderList').innerHTML = '';
    addExerciciosRow('perfilExerciciosBuilderList');
    populatePerfilTreinosDiaSelect();
    
    renderPerfilTreinosList();
    renderAll();
    showToast('Treino atribuído com sucesso!', 'success');
}

async function deletarTreino(workoutId) {
    if (confirm("Deseja excluir este treino?")) {
        const workout = appData.treinos.find(t => t.id === workoutId);
        if (!workout) return;

        appData.treinos = appData.treinos.filter(t => t.id !== workoutId);

        // Apaga do Supabase na tabela 'treinos'
        const { error } = await supabaseClientInstance
            .from('treinos')
            .delete()
            .eq('id', workoutId);

        if (error) {
            console.error("Erro ao excluir treino no Supabase:", error.message);
        }

        renderAll();
        showToast("Treino excluído com sucesso!", "success");
    }
}

async function deletarAluno(alunoId) {
    if (confirm("Deseja excluir este aluno e seus históricos associados?")) {
        appData.alunos = appData.alunos.filter(a => a.id !== alunoId);
        appData.treinos = appData.treinos.filter(t => t.alunoId !== alunoId);
        await saveAppData();
        renderAll();
        showToast('Aluno excluído com sucesso!', 'success');
    }
}

function updateAlunoSelectDropdown() {
    const select = document.getElementById('treinoAlunoSelect');
    if (select) {
        select.innerHTML = appData.alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
        onTreinoAlunoChange();
    }
}

function onTreinoAlunoChange() {
    const alunoId = document.getElementById('treinoAlunoSelect').value;
    const selectDia = document.getElementById('treinoDiaSemana');
    if (!selectDia) return;

    const aluno = appData.alunos.find(a => a.id === alunoId);
    selectDia.innerHTML = '<option value="" disabled selected>Selecione um dia ativo...</option>';

    if (aluno && aluno.agendaRecorrente && aluno.agendaRecorrente.length > 0) {
        aluno.agendaRecorrente.forEach(item => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify({ diaSemana: item.diaSemana, horario: item.horario });
            opt.textContent = `${diasSemanaMap[item.diaSemana]} (${item.horario})`;
            selectDia.appendChild(opt);
        });
    } else {
        selectDia.innerHTML = '<option value="" disabled selected>Este aluno não possui dias ativos configurados</option>';
    }
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    if (id === 'modalNovoTreino') {
        updateAlunoSelectDropdown();
        if (document.getElementById('exerciciosBuilderList').children.length === 0) {
            addExerciciosRow('exerciciosBuilderList');
        }
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function addExerciciosRow(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const novaLinha = document.createElement('div');
    novaLinha.className = 'exercicio-linha flex items-end gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm';
    
    novaLinha.innerHTML = `
        <div class="campo-wrapper flex-grow">
            <span class="input-title">Exercício</span>
            <input type="text" placeholder="Nome Ex: Supino" class="input-nome-ex w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-emerald-500" required oninput="checkRowWeightHistory(this, '${containerId}')">
        </div>
        <div class="campo-wrapper w-20">
            <span class="input-title">Séries</span>
            <input type="number" placeholder="3" class="input-series w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-emerald-500" min="1" required>
        </div>
        <div class="campo-wrapper w-20">
            <span class="input-title">Repetições</span>
            <input type="number" placeholder="12" class="input-repeticoes w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-emerald-500" min="1" required>
        </div>
        <div class="campo-wrapper w-20">
            <span class="input-title">Carga (kg)</span>
            <input type="number" placeholder="20" class="input-carga w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-emerald-500" min="0">
        </div>
        <button type="button" class="btn-remover-linha text-slate-400 hover:text-red-500 p-2 transition" onclick="removerLinhaExercicio(this)" title="Remover exercício">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    container.appendChild(novaLinha);
}

function removerLinhaExercicio(botao) {
    const linha = botao.closest('.exercicio-linha');
    if (linha) linha.remove();
}

function checkRowWeightHistory(inputElem, containerId) {
    const name = inputElem.value;
    const alunoId = containerId === 'perfilExerciciosBuilderList' ? currentEditingAlunoId : document.getElementById('treinoAlunoSelect').value;
    const row = inputElem.closest('.exercicio-linha');
    if (row && name.trim() && alunoId) {
        const history = getLastUsedWeightForExercise(alunoId, name);
        if (history) {
            const cargaInput = row.querySelector('.input-carga');
            if (cargaInput) cargaInput.value = history.cargaKg;
        }
    }
}

async function handleSalvarTreino(event) {
    event.preventDefault();
    const alunoId = document.getElementById('treinoAlunoSelect').value;
    const selectDiaVal = document.getElementById('treinoDiaSemana').value;
    
    if (!selectDiaVal) {
        showToast('Selecione um dia ativo válido.', 'error');
        return;
    }

    const agendaObj = JSON.parse(selectDiaVal);
    const dataCalculada = getDateForWeekday(agendaObj.diaSemana);
    const horario = agendaObj.horario;
    const tipo = document.getElementById('treinoTipo').value;
    const rows = document.querySelectorAll('#exerciciosBuilderList .exercicio-linha');
    
    const exercicios = Array.from(rows).map((row, index) => ({
        id: 'e_' + Date.now() + index,
        nome: row.querySelector('.input-nome-ex').value,
        series: parseInt(row.querySelector('.input-series').value) || 3,
        reps: row.querySelector('.input-repeticoes').value || "12",
        cargaKg: parseFloat(row.querySelector('.input-carga').value) || 0,
        concluido: false,
        obs: ""
    }));

    const novoTreino = {
        id: 't_' + Date.now(),
        alunoId,
        data: dataCalculada,
        horario,
        tipo,
        concluido: false,
        exercicios
    };

    appData.treinos.push(novoTreino);
    await persistirTreinosAlunoNoSupabase(alunoId);

    document.getElementById('exerciciosBuilderList').innerHTML = '';
    closeModal('modalNovoTreino');
    currentDateSelected = dataCalculada;
    selectedStudentIdForDay = alunoId;
    renderAll();
    showToast('Treino agendado com sucesso!', 'success');
}

async function handleSalvarAluno(event) {
    event.preventDefault();
    
    const nome = document.getElementById('alunoNome').value.trim();
    const objetivo = document.getElementById('alunoObjetivo').value.trim();
    const observacoes = document.getElementById('alunoObs').value.trim();
    const foto = document.getElementById('alunoFoto').value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

    const agendaRecorrente = [];
    document.querySelectorAll('.dia-check:checked').forEach(chk => {
        const diaSemana = parseInt(chk.value);
        const timeInput = document.getElementById(`horario_dia_${diaSemana}`);
        const horario = timeInput ? timeInput.value : '08:00';
        agendaRecorrente.push({ diaSemana, horario });
    });

    // Gerar um ID único para evitar o erro de NOT NULL na tabela
    const novoAluno = {
        id: 'a_' + Date.now(),
        nome,
        objetivo,
        observacoes,
        foto,
        agendaRecorrente
    };

    const { data, error } = await supabaseClientInstance
        .from('alunos')
        .insert([novoAluno])
        .select();

    if (error) {
        console.error('Erro ao salvar aluno no Supabase:', error.message);
        showToast('Erro ao salvar aluno: ' + error.message, 'error');
        return;
    }

    if (data && data.length > 0) {
        appData.alunos.push(data[0]);
    }

    closeModal('modalNovoAluno');
    document.getElementById('formNovoAluno').reset();
    renderAll();
    showToast('Aluno salvo no Supabase com sucesso!', 'success');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    let bgClass = 'bg-slate-900 text-white border-l-4 border-emerald-500';
    let iconClass = 'fa-circle-check text-emerald-400';
    
    if (type === 'error') {
        bgClass = 'bg-slate-900 text-white border-l-4 border-red-500';
        iconClass = 'fa-circle-exclamation text-red-400';
    }

    toast.className = `pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg text-xs font-medium transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass}`;
    toast.innerHTML = `<i class="fa-solid ${iconClass} text-sm"></i><span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// EXPOSIÇÃO GLOBAL DE FUNÇÕES PARA OS BOTÕES HTML
// ==========================================
window.shiftSelectedDate = function(deltaDays) {
    const [y, m, d] = currentDateSelected.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + deltaDays);
    currentDateSelected = formatDateToKey(dateObj);
    selectedStudentIdForDay = null;
    renderAll();
};