const { useState, useEffect, useRef, useCallback } = React;

// ========== API Helper ==========
const api = async (url, options = {}) => {
    const config = { headers: { 'Content-Type': 'application/json' }, ...options };
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }
    if (config.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    const res = await fetch(url, config);
    if (url.includes('/download')) return res;
    if (res.status === 429) {
        return { success: false, rate_limited: true, message: '요청 횟수를 초과했습니다.' };
    }
    return res.json();
};

// ========== Rate Limit Modal ==========
function RateLimitModal({ onClose }) {
    const [remaining, setRemaining] = useState(60);

    useEffect(() => {
        const timer = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onClose();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;

    return (
        <div className="modal-overlay">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
                <div className="text-5xl mb-4">&#9203;</div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">로그인 시도 횟수 초과</h2>
                <p className="text-sm text-gray-500 mb-5">
                    보안을 위해 잠시 후 다시 시도해주세요.<br/>
                    입력하신 정보가 정확한지 확인해보세요.
                </p>
                <div className="text-4xl font-mono font-bold text-indigo-600 mb-2">
                    {mins}:{secs.toString().padStart(2, '0')}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-5">
                    <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-1000"
                        style={{width: `${(remaining / 60) * 100}%`}}
                    ></div>
                </div>
                <p className="text-xs text-gray-400">자동으로 닫힙니다</p>
            </div>
        </div>
    );
}

// ========== Server Time Hook ==========
function useServerTime() {
    const [serverTime, setServerTime] = useState('');
    useEffect(() => {
        const fetchTime = () => api('/api/server-time').then(d => setServerTime(d.datetime)).catch(() => {});
        fetchTime();
        const timer = setInterval(fetchTime, 60000);
        return () => clearInterval(timer);
    }, []);
    return serverTime;
}

// ========== Toast Component ==========
function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, []);
    return <div className={`toast toast-${type}`}>{message}</div>;
}

// ========== Star Rating Component ==========
function StarRating({ value, onChange, label }) {
    return (
        <div className="flex items-center gap-1">
            <span className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</span>
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                    <span
                        key={star}
                        className={`star-btn ${star <= value ? 'active' : 'inactive'}`}
                        onClick={() => onChange(star)}
                    >&#9733;</span>
                ))}
            </div>
            <span className="text-sm text-gray-500 ml-1 w-8">{value}/5</span>
        </div>
    );
}

// ========== Score Badge ==========
function ScoreBadge({ score }) {
    const cls = score >= 4 ? 'score-green' : score >= 3 ? 'score-yellow' : 'score-red';
    return <span className={`${cls} px-2 py-1 rounded-full text-sm font-semibold`}>{score}</span>;
}

// ========== Help Button ==========
function HelpButton({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="fixed left-5 bottom-5 w-11 h-11 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold hover:bg-indigo-700 transition hover:scale-110 z-50"
            title="도움말"
        >?</button>
    );
}

// ========== Help Modal (Student) ==========
function StudentHelpModal({ onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-indigo-800">학생 사용 가이드</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="space-y-5">
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-semibold text-indigo-700 mb-2">평가 방법</h3>
                        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                            <li>로그인 후 본인이 속한 팀의 팀원 목록이 표시됩니다.</li>
                            <li>각 팀원에 대해 <strong>3가지 항목</strong>을 1~5점으로 평가합니다.</li>
                            <li><strong>평가 제출하기</strong> 버튼을 클릭하면 완료됩니다.</li>
                            <li>제출 후에는 수정할 수 없으니 신중하게 평가해주세요.</li>
                        </ol>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-lg">
                        <h3 className="font-semibold text-amber-700 mb-2">평가 항목 설명</h3>
                        <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex gap-2">
                                <span className="font-semibold text-amber-600 w-20 flex-shrink-0">회의 참석</span>
                                <span>팀 회의에 참석했는지 평가합니다. 5=매번 참석, 1=거의 불참</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-amber-600 w-20 flex-shrink-0">실질 기여</span>
                                <span>프로젝트에 실질적으로 기여했는지 평가합니다. 5=매우 기여, 1=기여 없음</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold text-amber-600 w-20 flex-shrink-0">참여 성실</span>
                                <span>전반적인 참여 성실도를 평가합니다. 5=매우 성실, 1=반복적 미참여</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-semibold text-green-700 mb-2">참고 사항</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                            <li>평가는 <strong>익명</strong>으로 처리됩니다. 누가 평가했는지 다른 학생에게 공개되지 않습니다.</li>
                            <li>매일 1회 평가를 제출하며, <strong>제출 후에는 수정할 수 없습니다.</strong></li>
                            <li>제출 직후 5초간 결과가 표시된 후 <strong>자동으로 가려집니다.</strong></li>
                            <li>재로그인해도 이전 평가 내용을 확인할 수 없습니다.</li>
                            <li>솔직하고 공정하게 평가해주세요.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ========== Help Modal (Admin) ==========
function AdminHelpModal({ onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '900px'}}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-indigo-800">관리자 사용 가이드</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="space-y-5">
                    {/* 초기 설정 */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-semibold text-indigo-700 mb-2">1. 초기 설정 순서</h3>
                        <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                            <li><strong>과정 관리</strong> 탭에서 교육 과정(코호트)을 추가합니다. (예: DT4 / MS Data 4기)</li>
                            <li>해당 과정에 <strong>students.json 파일을 업로드</strong>하여 학생을 등록합니다.</li>
                            <li><strong>프로젝트 관리</strong> 탭에서 새 프로젝트를 생성하고 팀을 구성합니다.</li>
                            <li>학생들에게 로그인 정보(이름 + 비밀번호)를 안내합니다.</li>
                        </ol>
                    </div>

                    {/* 과정 관리 */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                        <h3 className="font-semibold text-purple-700 mb-2">2. 과정 관리</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                            <li><strong>과정 추가</strong>: 과정 ID(영문 대문자)와 이름을 입력하여 새 교육 과정을 생성합니다.</li>
                            <li><strong>활성/비활성</strong>: 비활성화된 과정의 학생은 로그인할 수 없습니다.</li>
                            <li><strong>과정 삭제</strong>: &#10005; 버튼으로 과정과 모든 데이터(학생, 프로젝트, 평가)를 영구 삭제합니다. 되돌릴 수 없습니다.</li>
                            <li><strong>학생 수 표시</strong>: 각 과정에 등록된 학생 수가 표시됩니다. 업로드 후 즉시 반영됩니다.</li>
                            <li><strong>학생 업로드</strong>: 과정을 선택한 후 students.json 파일을 업로드합니다.</li>
                            <li>students.json 형식: <code>[{`{"id": 1, "name": "이름", "password": "1234"}`}]</code></li>
                            <li>기존 출석 시스템의 students.json을 그대로 사용할 수 있습니다.</li>
                        </ul>
                    </div>

                    {/* 프로젝트/팀 관리 */}
                    <div className="p-4 bg-green-50 rounded-lg">
                        <h3 className="font-semibold text-green-700 mb-2">3. 프로젝트 & 팀 관리</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                            <li><strong>새 프로젝트</strong>: 프로젝트 이름, 시작/종료일을 입력하고 팀을 구성합니다.</li>
                            <li><strong>팀 구성</strong>: 학생 카드를 드래그앤드롭으로 팀에 배정합니다. (모바일: 이동 드롭다운 사용)</li>
                            <li><strong>균등 배분</strong>: 모든 학생을 팀에 자동으로 랜덤 배분합니다.</li>
                            <li><strong>팀 이름 수정</strong>: 팀 컬럼 상단의 이름을 클릭하여 직접 수정할 수 있습니다.</li>
                            <li><strong>활성 프로젝트</strong>: 한 번에 하나의 프로젝트만 활성화됩니다. 학생은 활성 프로젝트의 팀원만 평가합니다.</li>
                            <li>새 프로젝트를 생성하면 기존 프로젝트는 자동으로 비활성화됩니다.</li>
                        </ul>
                    </div>

                    {/* 대시보드 */}
                    <div className="p-4 bg-amber-50 rounded-lg">
                        <h3 className="font-semibold text-amber-700 mb-2">4. 대시보드</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                            <li><strong>일간/주간/월간</strong>: 상단 토글로 조회 기간을 전환합니다. 날짜를 선택하면 해당 주 또는 월 전체가 자동 조회됩니다.</li>
                            <li><strong>추세 차트</strong>: 주간/월간 모드에서 일별 평균 점수 변화를 라인 차트로 확인합니다.</li>
                            <li><strong>제출 현황</strong>: 선택 기간 내 평가를 제출한/미제출한 학생 목록을 확인합니다.</li>
                            <li><strong>팀별 카드</strong>: 각 팀의 평균 점수를 한눈에 확인합니다. (초록: 4+, 노랑: 3~4, 빨강: 3 미만)</li>
                            <li><strong>학생 랭킹</strong>: 전체 학생을 종합 점수 낮은 순으로 정렬합니다. 3점 미만은 빨간 배경으로 강조됩니다.</li>
                            <li><strong>상세 보기</strong>: 학생 이름을 클릭하면 일별 추이 그래프와 평가자별 상세 점수를 확인합니다.</li>
                            <li><strong>CSV 다운로드</strong>: 전체 평가 데이터를 CSV로 내보낼 수 있습니다.</li>
                        </ul>
                    </div>

                    {/* 점수 기준 */}
                    <div className="p-4 bg-red-50 rounded-lg">
                        <h3 className="font-semibold text-red-700 mb-2">5. 점수 해석 기준</h3>
                        <div className="grid grid-cols-3 gap-3 text-sm text-center mt-2">
                            <div className="bg-green-100 rounded-lg p-3">
                                <div className="font-bold text-green-700 text-lg">4.0 ~ 5.0</div>
                                <div className="text-green-600">양호</div>
                            </div>
                            <div className="bg-yellow-100 rounded-lg p-3">
                                <div className="font-bold text-yellow-700 text-lg">3.0 ~ 3.9</div>
                                <div className="text-yellow-600">주의</div>
                            </div>
                            <div className="bg-red-100 rounded-lg p-3">
                                <div className="font-bold text-red-700 text-lg">1.0 ~ 2.9</div>
                                <div className="text-red-600">경고 (면담 권장)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ========== LOGIN PAGE ==========
function LoginPage({ onLogin, onAdminLogin, showToast }) {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [showAdmin, setShowAdmin] = useState(false);
    const [adminPw, setAdminPw] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const [showRateLimit, setShowRateLimit] = useState(false);
    const serverTime = useServerTime();

    const handleLogin = async () => {
        if (!name || !password) {
            showToast('이름과 비밀번호를 입력해주세요.', 'error');
            return;
        }
        const res = await api('/api/auth/login', {
            method: 'POST',
            body: { name, password }
        });
        if (res.success) {
            onLogin(res);
        } else if (res.rate_limited) {
            setShowRateLimit(true);
        } else {
            showToast(res.message, 'error');
        }
    };

    const handleAdminLogin = async () => {
        const res = await api('/api/auth/admin-login', {
            method: 'POST',
            body: { password: adminPw }
        });
        if (res.success) {
            onAdminLogin();
        } else if (res.rate_limited) {
            setShowRateLimit(true);
        } else {
            showToast(res.message, 'error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-indigo-800 mb-6">
                    프로젝트 동료 평가
                </h1>

                {!showAdmin ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                            <input
                                type="text"
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && document.getElementById('pw-input')?.focus()}
                                placeholder="이름을 입력하세요"
                                autoComplete="off"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                            <input
                                id="pw-input"
                                type="password"
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                placeholder="비밀번호"
                            />
                        </div>
                        <button
                            onClick={handleLogin}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            로그인
                        </button>
                        <button
                            onClick={() => setShowAdmin(true)}
                            className="w-full text-gray-500 text-sm hover:text-indigo-600 transition mt-2"
                        >
                            관리자 로그인
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">관리자 비밀번호</label>
                            <input
                                type="password"
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={adminPw}
                                onChange={e => setAdminPw(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                            />
                        </div>
                        <button
                            onClick={handleAdminLogin}
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                            관리자 로그인
                        </button>
                        <button
                            onClick={() => setShowAdmin(false)}
                            className="w-full text-gray-500 text-sm hover:text-indigo-600 transition"
                        >
                            학생 로그인으로 돌아가기
                        </button>
                    </div>
                )}
                {serverTime && (
                    <p className="text-center text-xs text-gray-400 mt-4">서버 시간 (KST): {serverTime}</p>
                )}
            </div>
            <HelpButton onClick={() => setShowHelp(true)} />
            {showHelp && <StudentHelpModal onClose={() => setShowHelp(false)} />}
            {showRateLimit && <RateLimitModal onClose={() => setShowRateLimit(false)} />}
        </div>
    );
}

// ========== STUDENT VIEW ==========
const RESULT_DISPLAY_SECONDS = 5;

function StudentView({ studentInfo, onLogout, showToast }) {
    const [teamInfo, setTeamInfo] = useState(null);
    const [scores, setScores] = useState({});
    const [loading, setLoading] = useState(true);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [justSubmitted, setJustSubmitted] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [submittedScores, setSubmittedScores] = useState([]);
    const [showHelp, setShowHelp] = useState(false);
    const countdownRef = useRef(null);
    const serverTime = useServerTime();

    useEffect(() => { loadTeamAndEval(); return () => clearInterval(countdownRef.current); }, []);

    const loadTeamAndEval = async () => {
        setLoading(true);
        const team = await api('/api/evaluation/my-team');
        setTeamInfo(team);

        if (team.success && team.members.length > 0) {
            const today = await api('/api/evaluation/today');
            if (today.has_submitted) {
                setHasSubmitted(true);
            } else {
                const initial = {};
                team.members.forEach(m => {
                    initial[m.id] = { meeting_attendance: 3, contribution: 3, repeated_absence: 5 };
                });
                setScores(initial);
            }
        }
        setLoading(false);
    };

    const updateScore = (memberId, field, value) => {
        setScores(prev => ({
            ...prev,
            [memberId]: { ...prev[memberId], [field]: value }
        }));
    };

    const startCountdown = () => {
        setCountdown(RESULT_DISPLAY_SECONDS);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current);
                    setJustSubmitted(false);
                    setSubmittedScores([]);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleSubmit = async () => {
        const evaluations = Object.entries(scores).map(([targetId, s]) => ({
            target_id: parseInt(targetId),
            meeting_attendance: s.meeting_attendance,
            contribution: s.contribution,
            repeated_absence: s.repeated_absence
        }));

        const res = await api('/api/evaluation/submit', {
            method: 'POST',
            body: { evaluations }
        });

        if (res.success) {
            // Save submitted scores temporarily for brief display
            const memberMap = {};
            teamInfo.members.forEach(m => { memberMap[m.id] = m.name; });
            const display = evaluations.map(ev => ({
                name: memberMap[ev.target_id] || '',
                meeting_attendance: ev.meeting_attendance,
                contribution: ev.contribution,
                repeated_absence: ev.repeated_absence
            }));

            setSubmittedScores(display);
            setHasSubmitted(true);
            setJustSubmitted(true);
            setScores({});
            showToast('평가가 제출되었습니다.', 'success');
            startCountdown();
        } else {
            showToast(res.message, 'error');
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-500 text-lg">로딩 중...</div>
        </div>;
    }

    // Already submitted view
    const renderSubmittedView = () => (
        <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">&#10003;</div>
                <h2 className="text-xl font-bold text-green-800 mb-2">오늘의 평가를 완료했습니다</h2>
                <p className="text-green-600">평가해주셔서 감사합니다. 내일 다시 평가해주세요.</p>
            </div>

            {/* Brief result display with countdown */}
            {justSubmitted && submittedScores.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-blue-800">제출된 평가</h3>
                        <span className="text-sm text-blue-500 font-mono">
                            {countdown}초 후 결과가 가려집니다
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-blue-200 rounded-full h-1.5 mb-4">
                        <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000"
                            style={{width: `${(countdown / RESULT_DISPLAY_SECONDS) * 100}%`}}
                        ></div>
                    </div>
                    <div className="space-y-2">
                        {submittedScores.map((s, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 text-sm">
                                <span className="font-medium">{s.name}</span>
                                <div className="flex gap-3 text-gray-600">
                                    <span>회의 <strong>{s.meeting_attendance}</strong></span>
                                    <span>기여 <strong>{s.contribution}</strong></span>
                                    <span>성실 <strong>{s.repeated_absence}</strong></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // Evaluation form view
    const renderEvalForm = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-800">오늘의 팀원 평가</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
                각 항목을 1~5점으로 평가해주세요. (1=매우 부족, 5=매우 우수)
                <br/>
                <span className="text-red-500 font-medium">제출 후에는 수정할 수 없습니다. 신중하게 평가해주세요.</span>
            </p>

            {teamInfo.members.map(member => (
                <div key={member.id} className="bg-white rounded-xl shadow-sm border p-5 card-hover">
                    <h3 className="font-semibold text-gray-800 mb-3 text-lg">{member.name}</h3>
                    <div className="space-y-2">
                        <StarRating
                            label="회의 참석"
                            value={scores[member.id]?.meeting_attendance || 3}
                            onChange={v => updateScore(member.id, 'meeting_attendance', v)}
                        />
                        <StarRating
                            label="실질 기여"
                            value={scores[member.id]?.contribution || 3}
                            onChange={v => updateScore(member.id, 'contribution', v)}
                        />
                        <StarRating
                            label="참여 성실"
                            value={scores[member.id]?.repeated_absence || 5}
                            onChange={v => updateScore(member.id, 'repeated_absence', v)}
                        />
                    </div>
                </div>
            ))}

            <button
                onClick={handleSubmit}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition text-lg"
            >
                평가 제출하기
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between">
                <div>
                    <span className="font-semibold">{studentInfo.student_name}</span>
                    {teamInfo?.success && (
                        <span className="ml-2 text-indigo-200 text-sm">
                            | {teamInfo.project_name} - {teamInfo.team_name}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {serverTime && <span className="text-indigo-300 text-xs">{serverTime}</span>}
                    <button onClick={onLogout} className="text-indigo-200 hover:text-white text-sm">로그아웃</button>
                </div>
            </div>

            <div className="container mx-auto p-4 max-w-2xl">
                {!teamInfo?.success ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-800 font-medium">{teamInfo?.message || '팀 정보를 불러올 수 없습니다.'}</p>
                    </div>
                ) : teamInfo.members.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                        <p className="text-yellow-800">팀원이 없습니다.</p>
                    </div>
                ) : hasSubmitted ? renderSubmittedView() : renderEvalForm()}
            </div>
            <HelpButton onClick={() => setShowHelp(true)} />
            {showHelp && <StudentHelpModal onClose={() => setShowHelp(false)} />}
        </div>
    );
}

// ========== ADMIN VIEW ==========
function AdminView({ onLogout, showToast }) {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [cohorts, setCohorts] = useState([]);
    const [selectedCohort, setSelectedCohort] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const serverTime = useServerTime();

    useEffect(() => {
        api('/api/cohorts').then(data => {
            setCohorts(data);
            const active = data.find(c => c.active);
            if (active) setSelectedCohort(active.cohort_id);
            else if (data.length > 0) setSelectedCohort(data[0].cohort_id);
        });
    }, []);

    const refreshCohorts = () => {
        api('/api/cohorts').then(setCohorts);
    };

    const tabs = [
        { id: 'dashboard', label: '대시보드' },
        { id: 'projects', label: '프로젝트 관리' },
        { id: 'cohorts', label: '과정 관리' }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-indigo-800 text-white px-4 py-3">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg">동료 평가 관리</h1>
                        {activeTab !== 'cohorts' && (
                            <select
                                className="bg-indigo-700 text-white border border-indigo-600 rounded px-2 py-1 text-sm"
                                value={selectedCohort}
                                onChange={e => setSelectedCohort(e.target.value)}
                            >
                                {cohorts.filter(c => c.active).map(c => (
                                    <option key={c.cohort_id} value={c.cohort_id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {serverTime && <span className="text-indigo-300 text-xs">{serverTime}</span>}
                        <button onClick={onLogout} className="text-indigo-300 hover:text-white text-sm">로그아웃</button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b">
                <div className="container mx-auto flex">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
                                activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="container mx-auto p-4">
                {activeTab === 'dashboard' && selectedCohort && (
                    <AdminDashboard cohortId={selectedCohort} showToast={showToast} />
                )}
                {activeTab === 'projects' && selectedCohort && (
                    <ProjectManagement cohortId={selectedCohort} showToast={showToast} />
                )}
                {activeTab === 'cohorts' && (
                    <CohortManagement cohorts={cohorts} refresh={refreshCohorts} showToast={showToast} onSelectCohort={setSelectedCohort} />
                )}
            </div>
            <HelpButton onClick={() => setShowHelp(true)} />
            {showHelp && <AdminHelpModal onClose={() => setShowHelp(false)} />}
        </div>
    );
}

// ========== COHORT MANAGEMENT ==========
function CohortManagement({ cohorts, refresh, showToast, onSelectCohort }) {
    const [newId, setNewId] = useState('');
    const [newName, setNewName] = useState('');
    const [uploadCohort, setUploadCohort] = useState('');
    const fileRef = useRef(null);

    const handleCreate = async () => {
        if (!newId || !newName) { showToast('ID와 이름을 입력해주세요.', 'error'); return; }
        const res = await api('/api/cohorts', { method: 'POST', body: { cohort_id: newId, name: newName } });
        if (res.success) {
            showToast('과정이 생성되었습니다.', 'success');
            setNewId(''); setNewName('');
            refresh();
        } else {
            showToast(res.message, 'error');
        }
    };

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const toggleActive = async (cohort) => {
        await api(`/api/cohorts/${cohort.cohort_id}`, {
            method: 'PUT',
            body: { active: !cohort.active }
        });
        refresh();
    };

    const handleDelete = async (cohortId) => {
        const res = await api(`/api/cohorts/${cohortId}?permanent=true`, { method: 'DELETE' });
        if (res.success) {
            showToast('과정이 완전히 삭제되었습니다.', 'success');
            setDeleteConfirm(null);
            refresh();
        } else {
            showToast(res.message, 'error');
        }
    };

    const handleUpload = async () => {
        if (!uploadCohort) { showToast('과정을 선택해주세요.', 'error'); return; }
        const file = fileRef.current?.files[0];
        if (!file) { showToast('파일을 선택해주세요.', 'error'); return; }

        const formData = new FormData();
        formData.append('file', file);

        const res = await api(`/api/cohorts/${uploadCohort}/students/upload`, {
            method: 'POST',
            body: formData,
            headers: {}
        });

        if (res.success) {
            showToast(`${res.count}명의 학생이 등록되었습니다.`, 'success');
            fileRef.current.value = '';
            refresh();
            if (onSelectCohort) onSelectCohort(uploadCohort);
        } else {
            showToast(res.message, 'error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Create Cohort */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">새 교육 과정 추가</h3>
                <div className="flex gap-3 flex-wrap">
                    <input
                        className="border rounded-lg px-3 py-2 w-32"
                        placeholder="과정 ID (예: DT4)"
                        value={newId}
                        onChange={e => setNewId(e.target.value.toUpperCase())}
                    />
                    <input
                        className="border rounded-lg px-3 py-2 flex-1 min-w-48"
                        placeholder="과정 이름 (예: MS Data 4기)"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                    <button onClick={handleCreate} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                        추가
                    </button>
                </div>
            </div>

            {/* Cohort List */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">교육 과정 목록</h3>
                {cohorts.length === 0 ? (
                    <p className="text-gray-500">등록된 과정이 없습니다.</p>
                ) : (
                    <div className="space-y-2">
                        {cohorts.map(c => (
                            <div key={c.cohort_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-indigo-700">{c.cohort_id}</span>
                                    <span className="text-gray-700">{c.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        c.student_count > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                        {c.student_count > 0 ? `${c.student_count}명` : '미등록'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleActive(c)}
                                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                                            c.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {c.active ? '활성' : '비활성'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(c)}
                                        className="px-2 py-1 rounded-full text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                                        title="과정 삭제"
                                    >&#10005;</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Students */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">학생 데이터 업로드</h3>
                <div className="space-y-3">
                    <select
                        className="border rounded-lg px-3 py-2 w-full"
                        value={uploadCohort}
                        onChange={e => setUploadCohort(e.target.value)}
                    >
                        <option value="">과정 선택</option>
                        {cohorts.filter(c => c.active).map(c => (
                            <option key={c.cohort_id} value={c.cohort_id}>{c.name} ({c.cohort_id})</option>
                        ))}
                    </select>
                    <input ref={fileRef} type="file" accept=".json" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    <p className="text-xs text-gray-400">{'students.json 형식: [{"id": 1, "name": "이름", "password": "1234"}, ...]'}</p>
                    <button onClick={handleUpload} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                        업로드
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="text-4xl mb-3 text-red-500">&#9888;</div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">과정 삭제</h3>
                            <p className="text-sm text-gray-600 mb-1">
                                <span className="font-semibold text-indigo-700">{deleteConfirm.name} ({deleteConfirm.cohort_id})</span>
                            </p>
                            <p className="text-sm text-red-600 mb-4">
                                학생, 프로젝트, 평가 데이터가 모두 삭제됩니다.<br/>이 작업은 되돌릴 수 없습니다.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-5 py-2 rounded-lg border text-gray-600 hover:bg-gray-50 transition"
                                >취소</button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm.cohort_id)}
                                    className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                                >삭제</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ========== PROJECT MANAGEMENT ==========
function ProjectManagement({ cohortId, showToast }) {
    const [projects, setProjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [editingProject, setEditingProject] = useState(null);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => { loadData(); }, [cohortId]);

    const loadData = async () => {
        const [projs, studs] = await Promise.all([
            api(`/api/cohorts/${cohortId}/projects`),
            api(`/api/cohorts/${cohortId}/students/names`)
        ]);
        setProjects(projs);
        setStudents(studs);
    };

    const activateProject = async (projectId) => {
        await api(`/api/cohorts/${cohortId}/projects/${projectId}/activate`, { method: 'PUT' });
        showToast('활성 프로젝트가 변경되었습니다.', 'success');
        loadData();
    };

    const deleteProject = async (projectId) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await api(`/api/cohorts/${cohortId}/projects/${projectId}`, { method: 'DELETE' });
        showToast('프로젝트가 삭제되었습니다.', 'success');
        loadData();
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">프로젝트 관리</h2>
                <button
                    onClick={() => { setEditingProject(null); setShowForm(true); }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                    + 새 프로젝트
                </button>
            </div>

            {showForm && (
                <TeamBuilder
                    cohortId={cohortId}
                    students={students}
                    project={editingProject}
                    onSave={() => { setShowForm(false); loadData(); }}
                    onCancel={() => setShowForm(false)}
                    showToast={showToast}
                />
            )}

            {/* Project List */}
            {projects.length === 0 && !showForm ? (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                    프로젝트가 없습니다. 새 프로젝트를 생성해주세요.
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map(proj => (
                        <div key={proj.project_id} className={`bg-white rounded-xl shadow-sm border p-5 ${proj.active ? 'border-indigo-300 ring-1 ring-indigo-200' : ''}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-lg">{proj.name}</h3>
                                    {proj.active && <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">활성</span>}
                                </div>
                                <div className="flex gap-2">
                                    {!proj.active && (
                                        <button onClick={() => activateProject(proj.project_id)} className="text-indigo-600 text-sm hover:underline">활성화</button>
                                    )}
                                    <button onClick={() => { setEditingProject(proj); setShowForm(true); }} className="text-blue-600 text-sm hover:underline">수정</button>
                                    <button onClick={() => deleteProject(proj.project_id)} className="text-red-600 text-sm hover:underline">삭제</button>
                                </div>
                            </div>
                            <div className="text-sm text-gray-500 mb-2">
                                {proj.start_date} ~ {proj.end_date}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(proj.teams || []).map(team => (
                                    <span key={team.team_id} className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full">
                                        {team.name} ({team.member_ids?.length || 0}명)
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ========== TEAM BUILDER (Drag & Drop) ==========
function TeamBuilder({ cohortId, students, project, onSave, onCancel, showToast }) {
    const [name, setName] = useState(project?.name || '');
    const [startDate, setStartDate] = useState(project?.start_date || '');
    const [endDate, setEndDate] = useState(project?.end_date || '');
    const [numTeams, setNumTeams] = useState(project?.teams?.length || 5);
    const [teams, setTeams] = useState([]);
    const [unassigned, setUnassigned] = useState([]);
    const dragItem = useRef(null);

    useEffect(() => {
        initTeams();
    }, []);

    const initTeams = () => {
        if (project && project.teams) {
            setTeams(project.teams.map(t => ({
                team_id: t.team_id,
                name: t.name,
                member_ids: [...t.member_ids]
            })));
            const assignedIds = new Set(project.teams.flatMap(t => t.member_ids));
            const unassignedIds = project.unassigned || students.filter(s => !assignedIds.has(s.id)).map(s => s.id);
            setUnassigned(unassignedIds);
        } else {
            const newTeams = Array.from({ length: numTeams }, (_, i) => ({
                team_id: i + 1,
                name: `팀 ${i + 1}`,
                member_ids: []
            }));
            setTeams(newTeams);
            setUnassigned(students.map(s => s.id));
        }
    };

    const adjustTeamCount = (count) => {
        count = Math.max(1, Math.min(20, count));
        setNumTeams(count);

        setTeams(prev => {
            if (count > prev.length) {
                const newTeams = [...prev];
                for (let i = prev.length; i < count; i++) {
                    newTeams.push({ team_id: i + 1, name: `팀 ${i + 1}`, member_ids: [] });
                }
                return newTeams;
            } else {
                const removed = prev.slice(count);
                const removedIds = removed.flatMap(t => t.member_ids);
                setUnassigned(u => [...u, ...removedIds]);
                return prev.slice(0, count);
            }
        });
    };

    const autoDistribute = () => {
        const newTeams = teams.map(t => ({ ...t, member_ids: [] }));
        const allIds = [...unassigned, ...teams.flatMap(t => t.member_ids)];

        // Shuffle
        for (let i = allIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
        }

        allIds.forEach((id, i) => {
            newTeams[i % newTeams.length].member_ids.push(id);
        });

        setTeams(newTeams);
        setUnassigned([]);
    };

    const getStudentName = (id) => {
        const s = students.find(s => s.id === id);
        return s ? s.name : `ID:${id}`;
    };

    // Drag & Drop handlers
    const handleDragStart = (e, studentId, sourceType, sourceIndex) => {
        dragItem.current = { studentId, sourceType, sourceIndex };
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('dragging');
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over');
    };

    const handleDrop = (e, targetType, targetIndex) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const { studentId, sourceType, sourceIndex } = dragItem.current;

        // Remove from source
        if (sourceType === 'unassigned') {
            setUnassigned(prev => prev.filter(id => id !== studentId));
        } else {
            setTeams(prev => prev.map((t, i) =>
                i === sourceIndex ? { ...t, member_ids: t.member_ids.filter(id => id !== studentId) } : t
            ));
        }

        // Add to target
        if (targetType === 'unassigned') {
            setUnassigned(prev => [...prev, studentId]);
        } else {
            setTeams(prev => prev.map((t, i) =>
                i === targetIndex ? { ...t, member_ids: [...t.member_ids, studentId] } : t
            ));
        }
    };

    // Mobile: dropdown move
    const moveStudent = (studentId, fromType, fromIndex, toType, toIndex) => {
        if (fromType === 'unassigned') {
            setUnassigned(prev => prev.filter(id => id !== studentId));
        } else {
            setTeams(prev => prev.map((t, i) =>
                i === fromIndex ? { ...t, member_ids: t.member_ids.filter(id => id !== studentId) } : t
            ));
        }

        if (toType === 'unassigned') {
            setUnassigned(prev => [...prev, studentId]);
        } else {
            setTeams(prev => prev.map((t, i) =>
                i === toIndex ? { ...t, member_ids: [...t.member_ids, studentId] } : t
            ));
        }
    };

    const handleSave = async () => {
        if (!name) { showToast('프로젝트 이름을 입력해주세요.', 'error'); return; }

        const payload = {
            name, start_date: startDate, end_date: endDate,
            teams: teams, unassigned: unassigned
        };

        let res;
        if (project) {
            res = await api(`/api/cohorts/${cohortId}/projects/${project.project_id}`, {
                method: 'PUT', body: payload
            });
        } else {
            res = await api(`/api/cohorts/${cohortId}/projects`, {
                method: 'POST', body: payload
            });
        }

        if (res.success) {
            showToast(project ? '프로젝트가 수정되었습니다.' : '프로젝트가 생성되었습니다.', 'success');
            onSave();
        } else {
            showToast(res.message, 'error');
        }
    };

    const StudentChip = ({ id, type, index }) => (
        <div
            draggable
            onDragStart={e => handleDragStart(e, id, type, index)}
            onDragEnd={handleDragEnd}
            className="bg-white border rounded-lg px-3 py-2 text-sm cursor-move hover:shadow-sm transition flex items-center justify-between gap-2"
        >
            <span>{getStudentName(id)}</span>
            {/* Mobile: select to move */}
            <select
                className="text-xs border rounded px-1 py-0.5 bg-gray-50 md:hidden"
                value=""
                onChange={e => {
                    const val = e.target.value;
                    if (val === 'unassigned') moveStudent(id, type, index, 'unassigned', -1);
                    else moveStudent(id, type, index, 'team', parseInt(val));
                    e.target.value = '';
                }}
            >
                <option value="">이동</option>
                <option value="unassigned">미배정</option>
                {teams.map((t, i) => (
                    <option key={t.team_id} value={i}>{t.name}</option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
            <h3 className="font-bold text-lg">{project ? '프로젝트 수정' : '새 프로젝트'}</h3>

            {/* Project Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="border rounded-lg px-3 py-2" placeholder="프로젝트 이름" value={name} onChange={e => setName(e.target.value)} />
                <input className="border rounded-lg px-3 py-2" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <input className="border rounded-lg px-3 py-2" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>

            {/* Team Count & Actions */}
            <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium">팀 수:</label>
                <input
                    type="number" min="1" max="20"
                    className="border rounded-lg px-3 py-2 w-20"
                    value={numTeams}
                    onChange={e => adjustTeamCount(parseInt(e.target.value) || 1)}
                />
                <button onClick={autoDistribute} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition">
                    균등 배분
                </button>
            </div>

            {/* Unassigned Pool */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-4 min-h-16"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, 'unassigned', -1)}
            >
                <h4 className="text-sm font-semibold text-gray-500 mb-2">미배정 ({unassigned.length}명)</h4>
                <div className="flex flex-wrap gap-2">
                    {unassigned.map(id => (
                        <StudentChip key={id} id={id} type="unassigned" index={-1} />
                    ))}
                </div>
            </div>

            {/* Team Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {teams.map((team, idx) => (
                    <div
                        key={team.team_id}
                        className="border-2 border-gray-200 rounded-xl p-3 min-h-32"
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, 'team', idx)}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <input
                                className="font-semibold text-sm bg-transparent border-b border-transparent focus:border-indigo-400 px-1 w-full"
                                value={team.name}
                                onChange={e => {
                                    const newTeams = [...teams];
                                    newTeams[idx].name = e.target.value;
                                    setTeams(newTeams);
                                }}
                            />
                            <span className="text-xs text-gray-400 ml-1">{team.member_ids.length}명</span>
                        </div>
                        <div className="space-y-1">
                            {team.member_ids.map(id => (
                                <StudentChip key={id} id={id} type="team" index={idx} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <button onClick={onCancel} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition">취소</button>
                <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                    {project ? '수정 저장' : '프로젝트 생성'}
                </button>
            </div>
        </div>
    );
}

// ========== ADMIN DASHBOARD ==========
function AdminDashboard({ cohortId, showToast }) {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState('daily');
    const [summary, setSummary] = useState([]);
    const [teamSummary, setTeamSummary] = useState([]);
    const [completion, setCompletion] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [detailStudent, setDetailStudent] = useState(null);
    const [detailData, setDetailData] = useState(null);

    const chartRef = useRef(null);
    const teamChartRef = useRef(null);
    const donutRef = useRef(null);
    const trendChartRef = useRef(null);
    const chartInstances = useRef({});

    const getDateRange = (d, mode) => {
        const dt = new Date(d + 'T00:00:00');
        if (mode === 'daily') return { start: d, end: d };
        if (mode === 'weekly') {
            const day = dt.getDay();
            const mon = new Date(dt);
            mon.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] };
        }
        if (mode === 'monthly') {
            const y = dt.getFullYear(), m = dt.getMonth();
            const first = new Date(y, m, 1);
            const last = new Date(y, m + 1, 0);
            return { start: first.toISOString().split('T')[0], end: last.toISOString().split('T')[0] };
        }
        return { start: d, end: d };
    };

    const getPeriodLabel = (d, mode) => {
        const { start, end } = getDateRange(d, mode);
        if (mode === 'daily') return start;
        if (mode === 'weekly') return `${start} ~ ${end}`;
        if (mode === 'monthly') {
            const dt = new Date(d + 'T00:00:00');
            return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
        }
        return start;
    };

    useEffect(() => {
        api(`/api/cohorts/${cohortId}/projects`).then(data => {
            setProjects(data);
            const active = data.find(p => p.active);
            if (active) setSelectedProject(active.project_id);
        });
    }, [cohortId]);

    useEffect(() => {
        if (selectedProject) loadDashboard();
    }, [selectedProject, date, viewMode]);

    const loadDashboard = async () => {
        const { start, end } = getDateRange(date, viewMode);
        const queries = [
            api(`/api/admin/${cohortId}/dashboard/summary?project_id=${selectedProject}&start_date=${start}&end_date=${end}`),
            api(`/api/admin/${cohortId}/dashboard/team-summary?project_id=${selectedProject}&start_date=${start}&end_date=${end}`),
            api(`/api/admin/${cohortId}/dashboard/completion?project_id=${selectedProject}&start_date=${start}&end_date=${end}`)
        ];
        if (viewMode !== 'daily') {
            queries.push(api(`/api/admin/${cohortId}/dashboard/trend?project_id=${selectedProject}&start_date=${start}&end_date=${end}`));
        }
        const results = await Promise.all(queries);
        setSummary(results[0]);
        setTeamSummary(results[1]);
        setCompletion(results[2]);
        setTrendData(viewMode !== 'daily' ? (results[3] || []) : []);
    };

    // Charts
    useEffect(() => {
        if (typeof Chart === 'undefined') return;
        renderCharts();
        return () => {
            Object.values(chartInstances.current).forEach(c => c?.destroy());
        };
    }, [summary, teamSummary, completion, trendData]);

    const renderCharts = () => {
        // Destroy existing
        Object.values(chartInstances.current).forEach(c => c?.destroy());
        chartInstances.current = {};

        // Completion Donut
        if (donutRef.current && completion) {
            const ctx = donutRef.current.getContext('2d');
            chartInstances.current.donut = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['제출', '미제출'],
                    datasets: [{
                        data: [completion.submitted_count, completion.total - completion.submitted_count],
                        backgroundColor: ['#6366f1', '#e5e7eb']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom' },
                        title: { display: true, text: `제출 현황 (${getPeriodLabel(date, viewMode)})` }
                    }
                }
            });
        }

        // Team Bar Chart
        if (teamChartRef.current && teamSummary.length > 0) {
            const ctx = teamChartRef.current.getContext('2d');
            chartInstances.current.team = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: teamSummary.map(t => t.team_name),
                    datasets: [
                        { label: '회의 참석', data: teamSummary.map(t => t.meeting_attendance_avg), backgroundColor: '#6366f1' },
                        { label: '실질 기여', data: teamSummary.map(t => t.contribution_avg), backgroundColor: '#8b5cf6' },
                        { label: '참여 성실', data: teamSummary.map(t => t.repeated_absence_avg), backgroundColor: '#a78bfa' }
                    ]
                },
                options: {
                    responsive: true,
                    scales: { y: { min: 0, max: 5 } },
                    plugins: { title: { display: true, text: `팀별 평균 점수 (${getPeriodLabel(date, viewMode)})` } }
                }
            });
        }

        // Trend Line Chart
        if (trendChartRef.current && trendData.length > 1) {
            const ctx = trendChartRef.current.getContext('2d');
            chartInstances.current.trend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: trendData.map(t => t.date.slice(5)),
                    datasets: [
                        { label: '회의 참석', data: trendData.map(t => t.meeting_attendance_avg), borderColor: '#6366f1', backgroundColor: '#6366f120', tension: 0.3, fill: false, pointRadius: 3 },
                        { label: '실질 기여', data: trendData.map(t => t.contribution_avg), borderColor: '#8b5cf6', backgroundColor: '#8b5cf620', tension: 0.3, fill: false, pointRadius: 3 },
                        { label: '참여 성실', data: trendData.map(t => t.repeated_absence_avg), borderColor: '#a78bfa', backgroundColor: '#a78bfa20', tension: 0.3, fill: false, pointRadius: 3 },
                        { label: '종합', data: trendData.map(t => t.overall_avg), borderColor: '#ef4444', backgroundColor: '#ef444420', tension: 0.3, fill: false, pointRadius: 3, borderDash: [5, 5] }
                    ]
                },
                options: {
                    responsive: true,
                    scales: { y: { min: 0, max: 5 } },
                    plugins: {
                        title: { display: true, text: `일별 평균 점수 추이 (${getPeriodLabel(date, viewMode)})` },
                        tooltip: {
                            callbacks: {
                                afterBody: (items) => {
                                    const idx = items[0]?.dataIndex;
                                    if (idx !== undefined && trendData[idx]) {
                                        return `평가 ${trendData[idx].eval_count}건 | 제출 ${trendData[idx].submitter_count}명`;
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // Student Bar Chart
        if (chartRef.current && summary.length > 0) {
            const ctx = chartRef.current.getContext('2d');
            chartInstances.current.student = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: summary.map(s => s.student_name),
                    datasets: [
                        { label: '회의 참석', data: summary.map(s => s.meeting_attendance_avg), backgroundColor: '#6366f1' },
                        { label: '실질 기여', data: summary.map(s => s.contribution_avg), backgroundColor: '#8b5cf6' },
                        { label: '참여 성실', data: summary.map(s => s.repeated_absence_avg), backgroundColor: '#a78bfa' }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    scales: { x: { min: 0, max: 5 } },
                    plugins: { title: { display: true, text: '학생별 평균 점수 (낮은 순)' } }
                }
            });
        }
    };

    const openDetail = async (studentId) => {
        setDetailStudent(studentId);
        const data = await api(`/api/admin/${cohortId}/dashboard/detail?project_id=${selectedProject}&target_id=${studentId}`);
        setDetailData(data);
    };

    const downloadCsv = async () => {
        const res = await api(`/api/admin/${cohortId}/dashboard/download?project_id=${selectedProject}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `peer_eval_${cohortId}_${date}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <select
                    className="border rounded-lg px-3 py-2"
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                >
                    {projects.map(p => (
                        <option key={p.project_id} value={p.project_id}>
                            {p.name} {p.active ? '(활성)' : ''}
                        </option>
                    ))}
                </select>
                <div className="flex border rounded-lg overflow-hidden">
                    {[{id: 'daily', label: '일간'}, {id: 'weekly', label: '주간'}, {id: 'monthly', label: '월간'}].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setViewMode(m.id)}
                            className={`px-3 py-2 text-sm font-medium transition ${viewMode === m.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >{m.label}</button>
                    ))}
                </div>
                <input type="date" className="border rounded-lg px-3 py-2" value={date} onChange={e => setDate(e.target.value)} />
                <button onClick={loadDashboard} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm">
                    새로고침
                </button>
                <button onClick={downloadCsv} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm">
                    CSV 다운로드
                </button>
            </div>
            {viewMode !== 'daily' && (
                <div className="text-sm text-gray-500 bg-indigo-50 rounded-lg px-4 py-2">
                    조회 기간: <span className="font-semibold text-indigo-700">{getPeriodLabel(date, viewMode)}</span>
                </div>
            )}

            {/* Trend Chart (weekly/monthly only) */}
            {viewMode !== 'daily' && trendData.length > 1 && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                    <canvas ref={trendChartRef}></canvas>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Completion Donut */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                    <canvas ref={donutRef} height="250"></canvas>
                    {completion && (
                        <div className="text-center mt-2">
                            <span className="text-2xl font-bold text-indigo-700">
                                {completion.submitted_count}/{completion.total}
                            </span>
                            <span className="text-gray-500 text-sm ml-1">
                                {viewMode === 'daily' ? '명 제출' : '명 제출 (기간 내 1회 이상)'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Team Chart */}
                <div className="bg-white rounded-xl shadow-sm border p-4 lg:col-span-2">
                    <canvas ref={teamChartRef}></canvas>
                </div>
            </div>

            {/* Team Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {teamSummary.map(team => (
                    <div key={team.team_id} className="bg-white rounded-xl shadow-sm border p-4 card-hover">
                        <h4 className="font-semibold mb-2">{team.team_name}</h4>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-500">종합 평균</span>
                            <ScoreBadge score={team.overall_avg} />
                        </div>
                        <div className="text-xs text-gray-400 space-y-1 mt-2">
                            <div className="flex justify-between"><span>회의 참석</span><span>{team.meeting_attendance_avg}</span></div>
                            <div className="flex justify-between"><span>실질 기여</span><span>{team.contribution_avg}</span></div>
                            <div className="flex justify-between"><span>참여 성실</span><span>{team.repeated_absence_avg}</span></div>
                        </div>
                        <div className="text-xs text-gray-400 mt-2">{team.member_count}명 | 평가 {team.eval_count}건</div>
                    </div>
                ))}
            </div>

            {/* Student Chart */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
                <canvas ref={chartRef} height={Math.max(200, summary.length * 25)}></canvas>
            </div>

            {/* Completion Lists */}
            {completion && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <h4 className="font-semibold text-green-700 mb-2">제출 완료 ({completion.submitted.length}명)</h4>
                        <div className="flex flex-wrap gap-1">
                            {completion.submitted.map(s => (
                                <span key={s.id} className="bg-green-50 text-green-700 text-sm px-2 py-1 rounded">{s.name}</span>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <h4 className="font-semibold text-red-700 mb-2">미제출 ({completion.not_submitted.length}명)</h4>
                        <div className="flex flex-wrap gap-1">
                            {completion.not_submitted.map(s => (
                                <span key={s.id} className="bg-red-50 text-red-700 text-sm px-2 py-1 rounded">{s.name}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Student Ranking Table */}
            {summary.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left">학생</th>
                                <th className="px-4 py-3 text-center">회의 참석</th>
                                <th className="px-4 py-3 text-center">실질 기여</th>
                                <th className="px-4 py-3 text-center">참여 성실</th>
                                <th className="px-4 py-3 text-center">종합</th>
                                <th className="px-4 py-3 text-center">평가 수</th>
                                <th className="px-4 py-3 text-center">상세</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.map(s => (
                                <tr key={s.student_id} className={`border-t ${s.overall_avg < 3 ? 'bg-red-50' : ''}`}>
                                    <td className="px-4 py-3 font-medium">{s.student_name}</td>
                                    <td className="px-4 py-3 text-center"><ScoreBadge score={s.meeting_attendance_avg} /></td>
                                    <td className="px-4 py-3 text-center"><ScoreBadge score={s.contribution_avg} /></td>
                                    <td className="px-4 py-3 text-center"><ScoreBadge score={s.repeated_absence_avg} /></td>
                                    <td className="px-4 py-3 text-center"><ScoreBadge score={s.overall_avg} /></td>
                                    <td className="px-4 py-3 text-center text-gray-500">{s.eval_count}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => openDetail(s.student_id)} className="text-indigo-600 hover:underline">보기</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {detailStudent && detailData && (
                <StudentDetailModal data={detailData} onClose={() => { setDetailStudent(null); setDetailData(null); }} />
            )}
        </div>
    );
}

// ========== STUDENT DETAIL MODAL ==========
function StudentDetailModal({ data, onClose }) {
    const trendRef = useRef(null);
    const chartInstance = useRef(null);

    useEffect(() => {
        if (trendRef.current && data.trend?.length > 0 && typeof Chart !== 'undefined') {
            chartInstance.current?.destroy();
            const ctx = trendRef.current.getContext('2d');
            chartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.trend.map(t => t.date),
                    datasets: [
                        { label: '회의 참석', data: data.trend.map(t => t.meeting_attendance_avg), borderColor: '#6366f1', tension: 0.3 },
                        { label: '실질 기여', data: data.trend.map(t => t.contribution_avg), borderColor: '#8b5cf6', tension: 0.3 },
                        { label: '참여 성실', data: data.trend.map(t => t.repeated_absence_avg), borderColor: '#a78bfa', tension: 0.3 }
                    ]
                },
                options: {
                    responsive: true,
                    scales: { y: { min: 0, max: 5 } },
                    plugins: { title: { display: true, text: '일별 점수 추이' } }
                }
            });
        }
        return () => chartInstance.current?.destroy();
    }, [data]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{data.student_name} - 상세 평가</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                {/* Trend Chart */}
                {data.trend?.length > 0 && (
                    <div className="mb-6">
                        <canvas ref={trendRef}></canvas>
                    </div>
                )}

                {/* Detail Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left">날짜</th>
                                <th className="px-3 py-2 text-left">평가자</th>
                                <th className="px-3 py-2 text-center">회의</th>
                                <th className="px-3 py-2 text-center">기여</th>
                                <th className="px-3 py-2 text-center">성실</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.details?.map((d, i) => (
                                <tr key={i} className="border-t">
                                    <td className="px-3 py-2">{d.date}</td>
                                    <td className="px-3 py-2">{d.evaluator_name}</td>
                                    <td className="px-3 py-2 text-center"><ScoreBadge score={d.meeting_attendance} /></td>
                                    <td className="px-3 py-2 text-center"><ScoreBadge score={d.contribution} /></td>
                                    <td className="px-3 py-2 text-center"><ScoreBadge score={d.repeated_absence} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ========== ROOT APP ==========
function PeerEvalApp() {
    const [view, setView] = useState('loading');
    const [studentInfo, setStudentInfo] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        api('/api/auth/status').then(data => {
            if (data.logged_in) {
                if (data.user_type === 'admin') {
                    setView('admin');
                } else {
                    setStudentInfo(data);
                    setView('student');
                }
            } else {
                setView('login');
            }
        });
    }, []);

    const handleLogout = async () => {
        await api('/api/auth/logout', { method: 'POST' });
        setView('login');
        setStudentInfo(null);
    };

    if (view === 'loading') {
        return <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-500 text-lg">로딩 중...</div>
        </div>;
    }

    return (
        <div>
            {view === 'login' && (
                <LoginPage
                    onLogin={(info) => { setStudentInfo(info); setView('student'); }}
                    onAdminLogin={() => setView('admin')}
                    showToast={showToast}
                />
            )}
            {view === 'student' && (
                <StudentView studentInfo={studentInfo} onLogout={handleLogout} showToast={showToast} />
            )}
            {view === 'admin' && (
                <AdminView onLogout={handleLogout} showToast={showToast} />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

ReactDOM.render(<PeerEvalApp />, document.getElementById('app'));
