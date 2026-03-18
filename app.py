from flask import Flask, render_template, jsonify, request, Response, session
from flask_compress import Compress
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
import datetime
import csv
import re
import uuid
from io import StringIO
from threading import RLock
from dotenv import load_dotenv
from cosmos_service import CosmosService

load_dotenv()

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 3600
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/xml',
    'application/json', 'application/javascript'
]
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1MB 파일 업로드 제한
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(hours=1)
app.secret_key = os.environ.get('SECRET_KEY', 'peer-eval-secret-key-change-in-production')

Compress(app)

limiter = Limiter(get_remote_address, app=app, default_limits=[])

db = CosmosService()
data_lock = RLock()

TEACHER_PASSWORD = os.environ.get('TEACHER_PASSWORD', 'teacher')

DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def get_kst_now():
    return datetime.datetime.utcnow() + datetime.timedelta(hours=9)


def get_kst_date():
    return get_kst_now().strftime('%Y-%m-%d')


# ========== AUTH HELPERS ==========

def require_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('user_type') != 'admin':
            return jsonify({'success': False, 'message': '관리자 권한이 필요합니다.'}), 403
        return f(*args, **kwargs)
    return decorated


def require_student(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('user_type') != 'student':
            return jsonify({'success': False, 'message': '학생 로그인이 필요합니다.'}), 403
        return f(*args, **kwargs)
    return decorated


def validate_date(date_str):
    """YYYY-MM-DD 형식 날짜 검증. 빈 문자열은 허용."""
    if not date_str:
        return True
    return bool(DATE_PATTERN.match(date_str))


# ========== SECURITY HEADERS ==========

@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response


# ========== MAIN PAGE ==========

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/server-time', methods=['GET'])
def server_time():
    now = get_kst_now()
    return jsonify({
        'datetime': now.strftime('%Y-%m-%d %H:%M:%S'),
        'date': now.strftime('%Y-%m-%d'),
        'time': now.strftime('%H:%M')
    })


# ========== AUTH API ==========

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5/minute")
def student_login():
    data = request.json
    name = data.get('name', '').strip()
    password = data.get('password', '').strip()

    if not name or not password:
        return jsonify({'success': False, 'message': '이름과 비밀번호를 입력해주세요.'})

    # 모든 활성 과정에서 이름+비밀번호 일치 학생 검색
    cohorts = db.load_cohorts()
    active_cohorts = [c for c in cohorts if c.get('active', True)]

    found_student = None
    found_cohort_id = None
    for cohort in active_cohorts:
        students = db.load_students(cohort['cohort_id'])
        student = next(
            (s for s in students if s['name'] == name and check_password_hash(s.get('password', ''), password)),
            None
        )
        if student:
            found_student = student
            found_cohort_id = cohort['cohort_id']
            break

    if not found_student:
        return jsonify({'success': False, 'message': '이름 또는 비밀번호가 올바르지 않습니다.'})

    session.permanent = True
    session['user_type'] = 'student'
    session['student_id'] = found_student['id']
    session['student_name'] = found_student['name']
    session['cohort_id'] = found_cohort_id

    return jsonify({
        'success': True,
        'student_id': found_student['id'],
        'student_name': found_student['name'],
        'cohort_id': found_cohort_id
    })


@app.route('/api/auth/admin-login', methods=['POST'])
@limiter.limit("5/minute")
def admin_login():
    data = request.json
    password = data.get('password', '')

    if password != TEACHER_PASSWORD:
        return jsonify({'success': False, 'message': '비밀번호가 올바르지 않습니다.'})

    session.permanent = True
    session['user_type'] = 'admin'
    return jsonify({'success': True})


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/api/auth/status', methods=['GET'])
def auth_status():
    user_type = session.get('user_type')
    if user_type == 'admin':
        return jsonify({'logged_in': True, 'user_type': 'admin'})
    elif user_type == 'student':
        return jsonify({
            'logged_in': True,
            'user_type': 'student',
            'student_id': session.get('student_id'),
            'student_name': session.get('student_name'),
            'cohort_id': session.get('cohort_id')
        })
    return jsonify({'logged_in': False})


# ========== COHORTS API ==========

@app.route('/api/cohorts', methods=['GET'])
def get_cohorts():
    cohorts = db.load_cohorts()
    active_only = request.args.get('active_only', 'false') == 'true'
    if active_only:
        cohorts = [c for c in cohorts if c.get('active', True)]
    # 각 과정의 학생 수 포함
    for c in cohorts:
        students = db.load_students(c['cohort_id'])
        c['student_count'] = len(students)
    return jsonify(cohorts)


@app.route('/api/cohorts', methods=['POST'])
@require_admin
def create_cohort():
    data = request.json
    cohort_id = data.get('cohort_id', '').strip().upper()
    name = data.get('name', '').strip()

    if not cohort_id or not name:
        return jsonify({'success': False, 'message': '코호트 ID와 이름을 입력해주세요.'})

    cohorts = db.load_cohorts()
    if any(c['cohort_id'] == cohort_id for c in cohorts):
        return jsonify({'success': False, 'message': '이미 존재하는 코호트 ID입니다.'})

    cohorts.append({
        'cohort_id': cohort_id,
        'name': name,
        'created_at': get_kst_now().isoformat(),
        'active': True
    })
    db.save_cohorts(cohorts)
    return jsonify({'success': True})


@app.route('/api/cohorts/<cohort_id>', methods=['PUT'])
@require_admin
def update_cohort(cohort_id):
    data = request.json
    cohorts = db.load_cohorts()
    cohort = next((c for c in cohorts if c['cohort_id'] == cohort_id), None)
    if not cohort:
        return jsonify({'success': False, 'message': '코호트를 찾을 수 없습니다.'}), 404

    if 'name' in data:
        cohort['name'] = data['name']
    if 'active' in data:
        cohort['active'] = data['active']

    db.save_cohorts(cohorts)
    return jsonify({'success': True})


@app.route('/api/cohorts/<cohort_id>', methods=['DELETE'])
@require_admin
def delete_cohort(cohort_id):
    cohorts = db.load_cohorts()
    cohort = next((c for c in cohorts if c['cohort_id'] == cohort_id), None)
    if not cohort:
        return jsonify({'success': False, 'message': '코호트를 찾을 수 없습니다.'}), 404

    permanent = request.args.get('permanent', 'false').lower() == 'true'

    if permanent:
        db.delete_cohort_data(cohort_id)
        cohorts = [c for c in cohorts if c['cohort_id'] != cohort_id]
        db.save_cohorts(cohorts)
        return jsonify({'success': True, 'message': '과정과 모든 데이터가 삭제되었습니다.'})
    else:
        cohort['active'] = False
        db.save_cohorts(cohorts)
        return jsonify({'success': True})


# ========== STUDENTS API ==========

@app.route('/api/cohorts/<cohort_id>/students', methods=['GET'])
@require_admin
def get_students(cohort_id):
    students = db.load_students(cohort_id)
    return jsonify(students)


@app.route('/api/cohorts/<cohort_id>/students/names', methods=['GET'])
@require_admin
def get_student_names(cohort_id):
    students = db.load_students(cohort_id)
    return jsonify([{'id': s['id'], 'name': s['name']} for s in students])


@app.route('/api/cohorts/<cohort_id>/students/upload', methods=['POST'])
@require_admin
def upload_students(cohort_id):
    if 'file' in request.files:
        file = request.files['file']
        if not file.filename.endswith('.json'):
            return jsonify({'success': False, 'message': 'JSON 파일만 업로드 가능합니다.'})
        try:
            content = file.read().decode('utf-8')
            raw_students = json.loads(content)
        except Exception as e:
            return jsonify({'success': False, 'message': f'파일 파싱 오류: {str(e)}'})
    elif request.json:
        raw_students = request.json.get('students', [])
    else:
        return jsonify({'success': False, 'message': '데이터가 없습니다.'})

    students = []
    for s in raw_students:
        raw_pw = str(s.get('password', ''))
        students.append({
            'id': s.get('id', len(students) + 1),
            'name': s.get('name', ''),
            'password': generate_password_hash(raw_pw)
        })

    if not students:
        return jsonify({'success': False, 'message': '유효한 학생 데이터가 없습니다.'})

    db.save_students(cohort_id, students)

    # Ensure cohort exists
    cohorts = db.load_cohorts()
    if not any(c['cohort_id'] == cohort_id for c in cohorts):
        cohorts.append({
            'cohort_id': cohort_id,
            'name': cohort_id,
            'created_at': get_kst_now().isoformat(),
            'active': True
        })
        db.save_cohorts(cohorts)

    return jsonify({'success': True, 'count': len(students)})


# ========== PROJECTS API ==========

@app.route('/api/cohorts/<cohort_id>/projects', methods=['GET'])
@require_admin
def get_projects(cohort_id):
    projects = db.load_projects(cohort_id)
    return jsonify(projects)


@app.route('/api/cohorts/<cohort_id>/projects', methods=['POST'])
@require_admin
def create_project(cohort_id):
    data = request.json
    name = data.get('name', '').strip()
    start_date = data.get('start_date', '')
    end_date = data.get('end_date', '')
    teams = data.get('teams', [])

    if not name:
        return jsonify({'success': False, 'message': '프로젝트 이름을 입력해주세요.'})

    projects = db.load_projects(cohort_id)

    # Deactivate other projects
    for p in projects:
        p['active'] = False

    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    projects.append({
        'project_id': project_id,
        'name': name,
        'start_date': start_date,
        'end_date': end_date,
        'active': True,
        'created_at': get_kst_now().isoformat(),
        'teams': teams,
        'unassigned': data.get('unassigned', [])
    })

    db.save_projects(cohort_id, projects)
    return jsonify({'success': True, 'project_id': project_id})


@app.route('/api/cohorts/<cohort_id>/projects/<project_id>', methods=['PUT'])
@require_admin
def update_project(cohort_id, project_id):
    data = request.json
    projects = db.load_projects(cohort_id)
    project = next((p for p in projects if p['project_id'] == project_id), None)

    if not project:
        return jsonify({'success': False, 'message': '프로젝트를 찾을 수 없습니다.'}), 404

    for key in ['name', 'start_date', 'end_date', 'teams', 'unassigned']:
        if key in data:
            project[key] = data[key]

    db.save_projects(cohort_id, projects)
    return jsonify({'success': True})


@app.route('/api/cohorts/<cohort_id>/projects/<project_id>', methods=['DELETE'])
@require_admin
def delete_project(cohort_id, project_id):
    projects = db.load_projects(cohort_id)
    projects = [p for p in projects if p['project_id'] != project_id]
    db.save_projects(cohort_id, projects)
    return jsonify({'success': True})


@app.route('/api/cohorts/<cohort_id>/projects/<project_id>/activate', methods=['PUT'])
@require_admin
def activate_project(cohort_id, project_id):
    projects = db.load_projects(cohort_id)
    for p in projects:
        p['active'] = (p['project_id'] == project_id)
    db.save_projects(cohort_id, projects)
    return jsonify({'success': True})


# ========== EVALUATION API (Student) ==========

@app.route('/api/evaluation/my-team', methods=['GET'])
@require_student
def get_my_team():
    cohort_id = session['cohort_id']
    student_id = session['student_id']

    projects = db.load_projects(cohort_id)
    active_project = next((p for p in projects if p.get('active')), None)

    if not active_project:
        return jsonify({'success': False, 'message': '활성 프로젝트가 없습니다.', 'members': []})

    my_team = None
    for team in active_project.get('teams', []):
        if student_id in team.get('member_ids', []):
            my_team = team
            break

    if not my_team:
        return jsonify({'success': False, 'message': '배정된 팀이 없습니다.', 'members': []})

    students = db.load_students(cohort_id)
    student_map = {s['id']: s['name'] for s in students}

    members = []
    for mid in my_team['member_ids']:
        if mid != student_id and mid in student_map:
            members.append({'id': mid, 'name': student_map[mid]})

    return jsonify({
        'success': True,
        'project_name': active_project['name'],
        'project_id': active_project['project_id'],
        'team_name': my_team.get('name', ''),
        'team_id': my_team['team_id'],
        'members': members
    })


@app.route('/api/evaluation/today', methods=['GET'])
@require_student
def get_today_evaluation():
    cohort_id = session['cohort_id']
    student_id = session['student_id']
    today = get_kst_date()

    evaluations = db.load_evaluations(cohort_id)
    my_eval = next(
        (e for e in evaluations
         if e['evaluator_id'] == student_id and e['date'] == today),
        None
    )

    # Only return whether submitted, never return scores back to student
    if my_eval:
        return jsonify({'success': True, 'has_submitted': True, 'submitted_at': my_eval.get('submitted_at', '')})
    return jsonify({'success': True, 'has_submitted': False})


@app.route('/api/evaluation/submit', methods=['POST'])
@require_student
def submit_evaluation():
    cohort_id = session['cohort_id']
    student_id = session['student_id']
    today = get_kst_date()

    data = request.json
    eval_data = data.get('evaluations', [])

    if not eval_data:
        return jsonify({'success': False, 'message': '평가 데이터가 없습니다.'})

    # Check if already submitted today (no re-submission allowed)
    evaluations_check = db.load_evaluations(cohort_id)
    already_submitted = any(
        e['evaluator_id'] == student_id and e['date'] == today
        for e in evaluations_check
    )
    if already_submitted:
        return jsonify({'success': False, 'message': '오늘 이미 평가를 제출하셨습니다.'}), 400

    # Validate scores
    for e in eval_data:
        for field in ['meeting_attendance', 'contribution', 'repeated_absence']:
            score = e.get(field)
            if not isinstance(score, (int, float)) or score < 1 or score > 5:
                return jsonify({'success': False, 'message': f'점수는 1~5 사이여야 합니다.'})

    # Get team info
    projects = db.load_projects(cohort_id)
    active_project = next((p for p in projects if p.get('active')), None)
    if not active_project:
        return jsonify({'success': False, 'message': '활성 프로젝트가 없습니다.'})

    my_team = None
    for team in active_project.get('teams', []):
        if student_id in team.get('member_ids', []):
            my_team = team
            break

    if not my_team:
        return jsonify({'success': False, 'message': '배정된 팀이 없습니다.'})

    # 평가 대상이 본인 팀원인지 검증
    valid_targets = set(mid for mid in my_team['member_ids'] if mid != student_id)
    for e in eval_data:
        if e.get('target_id') not in valid_targets:
            return jsonify({'success': False, 'message': '유효하지 않은 평가 대상입니다.'}), 400

    with data_lock:
        evaluations = db.load_evaluations(cohort_id)

        evaluations.append({
            'project_id': active_project['project_id'],
            'date': today,
            'evaluator_id': student_id,
            'team_id': my_team['team_id'],
            'evaluations': eval_data,
            'submitted_at': get_kst_now().isoformat()
        })

        db.save_evaluations(cohort_id, evaluations)

    return jsonify({'success': True, 'message': '평가가 저장되었습니다.'})


# ========== DASHBOARD API (Admin) ==========

@app.route('/api/admin/<cohort_id>/dashboard/summary', methods=['GET'])
@require_admin
def dashboard_summary(cohort_id):
    project_id = request.args.get('project_id', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')

    if not validate_date(start_date) or not validate_date(end_date):
        return jsonify({'success': False, 'message': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'}), 400

    evaluations = db.load_evaluations(cohort_id)
    students = db.load_students(cohort_id)
    student_map = {s['id']: s['name'] for s in students}

    # Filter evaluations
    filtered = evaluations
    if project_id:
        filtered = [e for e in filtered if e.get('project_id') == project_id]
    if start_date:
        filtered = [e for e in filtered if e.get('date', '') >= start_date]
    if end_date:
        filtered = [e for e in filtered if e.get('date', '') <= end_date]

    # Aggregate per target student
    summary = {}
    for record in filtered:
        for ev in record.get('evaluations', []):
            tid = ev['target_id']
            if tid not in summary:
                summary[tid] = {
                    'student_id': tid,
                    'student_name': student_map.get(tid, f'ID:{tid}'),
                    'count': 0,
                    'meeting_attendance_sum': 0,
                    'contribution_sum': 0,
                    'repeated_absence_sum': 0
                }
            s = summary[tid]
            s['count'] += 1
            s['meeting_attendance_sum'] += ev.get('meeting_attendance', 0)
            s['contribution_sum'] += ev.get('contribution', 0)
            s['repeated_absence_sum'] += ev.get('repeated_absence', 0)

    result = []
    for s in summary.values():
        c = s['count']
        result.append({
            'student_id': s['student_id'],
            'student_name': s['student_name'],
            'eval_count': c,
            'meeting_attendance_avg': round(s['meeting_attendance_sum'] / c, 2) if c else 0,
            'contribution_avg': round(s['contribution_sum'] / c, 2) if c else 0,
            'repeated_absence_avg': round(s['repeated_absence_sum'] / c, 2) if c else 0,
            'overall_avg': round(
                (s['meeting_attendance_sum'] + s['contribution_sum'] + s['repeated_absence_sum']) / (c * 3), 2
            ) if c else 0
        })

    result.sort(key=lambda x: x['overall_avg'])
    return jsonify(result)


@app.route('/api/admin/<cohort_id>/dashboard/team-summary', methods=['GET'])
@require_admin
def dashboard_team_summary(cohort_id):
    project_id = request.args.get('project_id', '')
    start_date = request.args.get('start_date', request.args.get('date', get_kst_date()))
    end_date = request.args.get('end_date', start_date)

    if not validate_date(start_date) or not validate_date(end_date):
        return jsonify({'success': False, 'message': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'}), 400

    projects = db.load_projects(cohort_id)
    project = None
    if project_id:
        project = next((p for p in projects if p['project_id'] == project_id), None)
    else:
        project = next((p for p in projects if p.get('active')), None)

    if not project:
        return jsonify([])

    evaluations = db.load_evaluations(cohort_id)
    students = db.load_students(cohort_id)
    student_map = {s['id']: s['name'] for s in students}

    filtered = [e for e in evaluations if e.get('project_id') == project['project_id']]
    filtered = [e for e in filtered if start_date <= e.get('date', '') <= end_date]

    team_summaries = []
    for team in project.get('teams', []):
        team_member_ids = set(team.get('member_ids', []))
        team_evals = []
        for record in filtered:
            for ev in record.get('evaluations', []):
                if ev['target_id'] in team_member_ids:
                    team_evals.append(ev)

        if team_evals:
            avg_meeting = round(sum(e['meeting_attendance'] for e in team_evals) / len(team_evals), 2)
            avg_contribution = round(sum(e['contribution'] for e in team_evals) / len(team_evals), 2)
            avg_absence = round(sum(e['repeated_absence'] for e in team_evals) / len(team_evals), 2)
            avg_overall = round((avg_meeting + avg_contribution + avg_absence) / 3, 2)
        else:
            avg_meeting = avg_contribution = avg_absence = avg_overall = 0

        team_summaries.append({
            'team_id': team['team_id'],
            'team_name': team.get('name', f"팀 {team['team_id']}"),
            'member_count': len(team_member_ids),
            'members': [{'id': mid, 'name': student_map.get(mid, '')} for mid in team['member_ids']],
            'meeting_attendance_avg': avg_meeting,
            'contribution_avg': avg_contribution,
            'repeated_absence_avg': avg_absence,
            'overall_avg': avg_overall,
            'eval_count': len(team_evals)
        })

    return jsonify(team_summaries)


@app.route('/api/admin/<cohort_id>/dashboard/completion', methods=['GET'])
@require_admin
def dashboard_completion(cohort_id):
    project_id = request.args.get('project_id', '')
    start_date = request.args.get('start_date', request.args.get('date', get_kst_date()))
    end_date = request.args.get('end_date', start_date)

    if not validate_date(start_date) or not validate_date(end_date):
        return jsonify({'success': False, 'message': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'}), 400

    projects = db.load_projects(cohort_id)
    project = None
    if project_id:
        project = next((p for p in projects if p['project_id'] == project_id), None)
    else:
        project = next((p for p in projects if p.get('active')), None)

    if not project:
        return jsonify({'submitted': [], 'not_submitted': [], 'total': 0, 'submitted_count': 0})

    all_member_ids = set()
    for team in project.get('teams', []):
        all_member_ids.update(team.get('member_ids', []))

    evaluations = db.load_evaluations(cohort_id)
    submitted_ids = set()
    for e in evaluations:
        if e.get('project_id') == project['project_id'] and start_date <= e.get('date', '') <= end_date:
            submitted_ids.add(e['evaluator_id'])

    students = db.load_students(cohort_id)
    student_map = {s['id']: s['name'] for s in students}

    submitted = [{'id': sid, 'name': student_map.get(sid, '')} for sid in submitted_ids if sid in all_member_ids]
    not_submitted = [{'id': sid, 'name': student_map.get(sid, '')} for sid in all_member_ids if sid not in submitted_ids]

    return jsonify({
        'submitted': submitted,
        'not_submitted': not_submitted,
        'total': len(all_member_ids),
        'submitted_count': len(submitted)
    })


@app.route('/api/admin/<cohort_id>/dashboard/trend', methods=['GET'])
@require_admin
def dashboard_trend(cohort_id):
    project_id = request.args.get('project_id', '')
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')

    if not validate_date(start_date) or not validate_date(end_date):
        return jsonify({'success': False, 'message': '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'}), 400

    evaluations = db.load_evaluations(cohort_id)

    filtered = evaluations
    if project_id:
        filtered = [e for e in filtered if e.get('project_id') == project_id]
    filtered = [e for e in filtered if start_date <= e.get('date', '') <= end_date]

    # Group by date
    daily = {}
    for record in filtered:
        d = record.get('date', '')
        if d not in daily:
            daily[d] = {'meeting_sum': 0, 'contribution_sum': 0, 'absence_sum': 0, 'count': 0, 'submitters': set()}
        daily[d]['submitters'].add(record['evaluator_id'])
        for ev in record.get('evaluations', []):
            daily[d]['meeting_sum'] += ev.get('meeting_attendance', 0)
            daily[d]['contribution_sum'] += ev.get('contribution', 0)
            daily[d]['absence_sum'] += ev.get('repeated_absence', 0)
            daily[d]['count'] += 1

    result = []
    for d in sorted(daily.keys()):
        dd = daily[d]
        c = dd['count']
        result.append({
            'date': d,
            'meeting_attendance_avg': round(dd['meeting_sum'] / c, 2) if c else 0,
            'contribution_avg': round(dd['contribution_sum'] / c, 2) if c else 0,
            'repeated_absence_avg': round(dd['absence_sum'] / c, 2) if c else 0,
            'overall_avg': round(
                (dd['meeting_sum'] + dd['contribution_sum'] + dd['absence_sum']) / (c * 3), 2
            ) if c else 0,
            'eval_count': c,
            'submitter_count': len(dd['submitters'])
        })

    return jsonify(result)


@app.route('/api/admin/<cohort_id>/dashboard/detail', methods=['GET'])
@require_admin
def dashboard_detail(cohort_id):
    project_id = request.args.get('project_id', '')
    target_id = request.args.get('target_id', type=int)

    if not target_id:
        return jsonify({'success': False, 'message': 'target_id가 필요합니다.'})

    evaluations = db.load_evaluations(cohort_id)
    students = db.load_students(cohort_id)
    student_map = {s['id']: s['name'] for s in students}

    filtered = evaluations
    if project_id:
        filtered = [e for e in filtered if e.get('project_id') == project_id]

    details = []
    for record in filtered:
        for ev in record.get('evaluations', []):
            if ev['target_id'] == target_id:
                details.append({
                    'date': record['date'],
                    'evaluator_id': record['evaluator_id'],
                    'evaluator_name': student_map.get(record['evaluator_id'], ''),
                    'meeting_attendance': ev['meeting_attendance'],
                    'contribution': ev['contribution'],
                    'repeated_absence': ev['repeated_absence'],
                    'submitted_at': record.get('submitted_at', '')
                })

    details.sort(key=lambda x: x['date'])

    # Daily aggregation for trend chart
    daily = {}
    for d in details:
        date = d['date']
        if date not in daily:
            daily[date] = {'count': 0, 'meeting': 0, 'contribution': 0, 'absence': 0}
        daily[date]['count'] += 1
        daily[date]['meeting'] += d['meeting_attendance']
        daily[date]['contribution'] += d['contribution']
        daily[date]['absence'] += d['repeated_absence']

    trend = []
    for date in sorted(daily.keys()):
        c = daily[date]['count']
        trend.append({
            'date': date,
            'meeting_attendance_avg': round(daily[date]['meeting'] / c, 2),
            'contribution_avg': round(daily[date]['contribution'] / c, 2),
            'repeated_absence_avg': round(daily[date]['absence'] / c, 2)
        })

    return jsonify({
        'student_name': student_map.get(target_id, ''),
        'details': details,
        'trend': trend
    })


@app.route('/api/admin/<cohort_id>/dashboard/download', methods=['GET'])
@require_admin
def dashboard_download(cohort_id):
    project_id = request.args.get('project_id', '')

    evaluations = db.load_evaluations(cohort_id)
    students = db.load_students(cohort_id)
    student_map = {s['id']: s['name'] for s in students}

    if project_id:
        evaluations = [e for e in evaluations if e.get('project_id') == project_id]

    csv_buffer = StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(['날짜', '평가자', '대상자', '회의참석', '실질기여', '반복미참여', '제출시간'])

    for record in evaluations:
        evaluator_name = student_map.get(record['evaluator_id'], str(record['evaluator_id']))
        for ev in record.get('evaluations', []):
            target_name = student_map.get(ev['target_id'], str(ev['target_id']))
            writer.writerow([
                record['date'],
                evaluator_name,
                target_name,
                ev.get('meeting_attendance', ''),
                ev.get('contribution', ''),
                ev.get('repeated_absence', ''),
                record.get('submitted_at', '')
            ])

    csv_buffer.seek(0)
    cohorts = db.load_cohorts()
    cohort_name = next((c['name'] for c in cohorts if c['cohort_id'] == cohort_id), cohort_id)
    filename = f"peer_eval_{cohort_name}_{get_kst_date()}.csv"

    return Response(
        csv_buffer.getvalue().encode('utf-8-sig'),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )


# ========== RUN ==========

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    debug = os.environ.get('FLASK_ENV', 'production') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
