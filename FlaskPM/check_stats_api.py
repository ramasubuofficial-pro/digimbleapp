import requests
try:
    url = "http://127.0.0.1:5000/api/stats?debug_admin=1"
    res = requests.get(url)
    print(f"Status: {res.status_code}")
    data = res.json()
    
    ms = data.get('member_stats')
    print(f"Member Stats Length: {len(ms) if ms else 'None'}")
    if ms:
        print(f"First Member: {ms[0]}")
        
    pp = data.get('project_performance')
    print(f"Project Perf Length: {len(pp) if pp else 'None'}")
    
except Exception as e:
    print(f"Error: {e}")
