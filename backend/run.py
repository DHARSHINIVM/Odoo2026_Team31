import sys
import os
import uvicorn

# Ensure the backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

if __name__ == "__main__":
    print("================================================================")
    print(" SunPower Solutions – Solar Installation Management System")
    print(" Backend Server Starting on http://127.0.0.1:8000")
    print(" API Documentation: http://127.0.0.1:8000/docs")
    print(" Health Endpoint:   http://127.0.0.1:8000/api/health")
    print("================================================================")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

