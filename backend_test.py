#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Real-World Racing App
Tests all authentication, circuit, race, friend, and group endpoints
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class RacingAppTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.auth_token = None
        self.test_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.api_url}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        
        if self.auth_token:
            request_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        if headers:
            request_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=request_headers, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=request_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=request_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            raise

    def test_user_registration(self):
        """Test 1: User Registration"""
        import time
        timestamp = int(time.time())
        test_data = {
            "email": f"racer.john.{timestamp}@example.com",
            "password": "SecurePass123!",
            "name": "John Racer"
        }
        self.test_email = test_data["email"]
        
        try:
            response = self.make_request("POST", "/auth/register", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.test_user_id = data["user"]["id"]
                    self.log_test("User Registration", True, f"User created with ID: {self.test_user_id}")
                    return True
                else:
                    self.log_test("User Registration", False, "Missing access_token or user in response", data)
            else:
                self.log_test("User Registration", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("User Registration", False, f"Exception: {str(e)}")
        return False

    def test_duplicate_registration(self):
        """Test 22: Registration with existing email should fail"""
        test_data = {
            "email": self.test_email,  # Same email as before
            "password": "AnotherPass123!",
            "name": "Another John"
        }
        
        try:
            response = self.make_request("POST", "/auth/register", test_data)
            
            if response.status_code == 400:
                self.log_test("Duplicate Registration (Should Fail)", True, "Correctly rejected duplicate email")
                return True
            else:
                self.log_test("Duplicate Registration (Should Fail)", False, f"Expected 400, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Duplicate Registration (Should Fail)", False, f"Exception: {str(e)}")
        return False

    def test_user_login(self):
        """Test 2: User Login"""
        test_data = {
            "email": self.test_email,
            "password": "SecurePass123!"
        }
        
        try:
            response = self.make_request("POST", "/auth/login", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.log_test("User Login", True, f"Login successful for user: {data['user']['name']}")
                    return True
                else:
                    self.log_test("User Login", False, "Missing access_token or user in response", data)
            else:
                self.log_test("User Login", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("User Login", False, f"Exception: {str(e)}")
        return False

    def test_wrong_password_login(self):
        """Test 23: Login with wrong password should fail"""
        test_data = {
            "email": self.test_email,
            "password": "WrongPassword123!"
        }
        
        try:
            response = self.make_request("POST", "/auth/login", test_data)
            
            if response.status_code == 401:
                self.log_test("Wrong Password Login (Should Fail)", True, "Correctly rejected wrong password")
                return True
            else:
                self.log_test("Wrong Password Login (Should Fail)", False, f"Expected 401, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Wrong Password Login (Should Fail)", False, f"Exception: {str(e)}")
        return False

    def test_get_current_user(self):
        """Test 3: Get Current User"""
        try:
            response = self.make_request("GET", "/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data and "name" in data:
                    self.log_test("Get Current User", True, f"Retrieved user: {data['name']} ({data['email']})")
                    return True
                else:
                    self.log_test("Get Current User", False, "Missing required user fields", data)
            else:
                self.log_test("Get Current User", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Current User", False, f"Exception: {str(e)}")
        return False

    def test_unauthorized_access(self):
        """Test 24: Access protected route without token should fail"""
        # Temporarily remove auth token
        original_token = self.auth_token
        self.auth_token = None
        
        try:
            response = self.make_request("GET", "/auth/me")
            
            if response.status_code == 403 or response.status_code == 401:
                self.log_test("Unauthorized Access (Should Fail)", True, "Correctly rejected request without token")
                success = True
            else:
                self.log_test("Unauthorized Access (Should Fail)", False, f"Expected 401/403, got {response.status_code}", response.text)
                success = False
        except Exception as e:
            self.log_test("Unauthorized Access (Should Fail)", False, f"Exception: {str(e)}")
            success = False
        finally:
            # Restore auth token
            self.auth_token = original_token
        
        return success

    def test_create_public_circuit(self):
        """Test 4: Create Public Circuit"""
        test_data = {
            "name": "Silverstone Grand Prix Circuit",
            "coordinates": [
                {"latitude": 52.0786, "longitude": -1.0169},
                {"latitude": 52.0790, "longitude": -1.0165},
                {"latitude": 52.0785, "longitude": -1.0160},
                {"latitude": 52.0780, "longitude": -1.0165}
            ],
            "distance": 5.891,
            "is_public": True
        }
        
        try:
            response = self.make_request("POST", "/circuits", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "name" in data and data["is_public"] == True:
                    self.public_circuit_id = data["id"]
                    self.log_test("Create Public Circuit", True, f"Created circuit: {data['name']} (ID: {data['id']})")
                    return True
                else:
                    self.log_test("Create Public Circuit", False, "Missing required circuit fields", data)
            else:
                self.log_test("Create Public Circuit", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Public Circuit", False, f"Exception: {str(e)}")
        return False

    def test_create_private_circuit(self):
        """Test 5: Create Private Circuit"""
        test_data = {
            "name": "My Private Track",
            "coordinates": [
                {"latitude": 51.5074, "longitude": -0.1278},
                {"latitude": 51.5080, "longitude": -0.1270},
                {"latitude": 51.5075, "longitude": -0.1265}
            ],
            "distance": 2.5,
            "is_public": False
        }
        
        try:
            response = self.make_request("POST", "/circuits", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "name" in data and data["is_public"] == False:
                    self.private_circuit_id = data["id"]
                    self.log_test("Create Private Circuit", True, f"Created private circuit: {data['name']} (ID: {data['id']})")
                    return True
                else:
                    self.log_test("Create Private Circuit", False, "Missing required circuit fields", data)
            else:
                self.log_test("Create Private Circuit", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Private Circuit", False, f"Exception: {str(e)}")
        return False

    def test_get_all_circuits(self):
        """Test 6: Get All Circuits (public + user's private)"""
        try:
            response = self.make_request("GET", "/circuits")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= 2:  # Should have at least our 2 circuits
                    public_count = sum(1 for c in data if c.get("is_public", False))
                    private_count = sum(1 for c in data if not c.get("is_public", True))
                    self.log_test("Get All Circuits", True, f"Retrieved {len(data)} circuits ({public_count} public, {private_count} private)")
                    return True
                else:
                    self.log_test("Get All Circuits", False, f"Expected list with circuits, got: {type(data)}", data)
            else:
                self.log_test("Get All Circuits", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get All Circuits", False, f"Exception: {str(e)}")
        return False

    def test_get_public_circuits(self):
        """Test 7: Get Public Circuits Only"""
        try:
            response = self.make_request("GET", "/circuits?is_public=true")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    all_public = all(c.get("is_public", False) for c in data)
                    if all_public:
                        self.log_test("Get Public Circuits", True, f"Retrieved {len(data)} public circuits")
                        return True
                    else:
                        self.log_test("Get Public Circuits", False, "Some circuits are not public", data)
                else:
                    self.log_test("Get Public Circuits", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_test("Get Public Circuits", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Public Circuits", False, f"Exception: {str(e)}")
        return False

    def test_get_private_circuits(self):
        """Test 8: Get Private Circuits Only"""
        try:
            response = self.make_request("GET", "/circuits?is_public=false")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    all_private = all(not c.get("is_public", True) for c in data)
                    if all_private or len(data) == 0:  # Empty list is also valid
                        self.log_test("Get Private Circuits", True, f"Retrieved {len(data)} private circuits")
                        return True
                    else:
                        self.log_test("Get Private Circuits", False, "Some circuits are public", data)
                else:
                    self.log_test("Get Private Circuits", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_test("Get Private Circuits", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Private Circuits", False, f"Exception: {str(e)}")
        return False

    def test_get_circuit_by_id(self):
        """Test 9: Get Specific Circuit by ID"""
        if not hasattr(self, 'public_circuit_id'):
            self.log_test("Get Circuit by ID", False, "No circuit ID available from previous tests")
            return False
            
        try:
            response = self.make_request("GET", f"/circuits/{self.public_circuit_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["id"] == self.public_circuit_id:
                    self.log_test("Get Circuit by ID", True, f"Retrieved circuit: {data.get('name', 'Unknown')}")
                    return True
                else:
                    self.log_test("Get Circuit by ID", False, "Circuit ID mismatch", data)
            else:
                self.log_test("Get Circuit by ID", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Circuit by ID", False, f"Exception: {str(e)}")
        return False

    def test_create_race(self):
        """Test 11: Create Race on Circuit"""
        if not hasattr(self, 'public_circuit_id'):
            self.log_test("Create Race", False, "No circuit ID available from previous tests")
            return False
            
        test_data = {
            "circuit_id": self.public_circuit_id
        }
        
        try:
            response = self.make_request("POST", "/races", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "status" in data and data["status"] == "waiting":
                    self.race_id = data["id"]
                    self.log_test("Create Race", True, f"Created race: {data['id']} on circuit {data.get('circuit_name', 'Unknown')}")
                    return True
                else:
                    self.log_test("Create Race", False, "Missing required race fields", data)
            else:
                self.log_test("Create Race", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Race", False, f"Exception: {str(e)}")
        return False

    def test_create_race_nonexistent_circuit(self):
        """Test 25: Create race on non-existent circuit should fail"""
        test_data = {
            "circuit_id": "nonexistent-circuit-id-12345"
        }
        
        try:
            response = self.make_request("POST", "/races", test_data)
            
            if response.status_code == 404:
                self.log_test("Create Race on Non-existent Circuit (Should Fail)", True, "Correctly rejected non-existent circuit")
                return True
            else:
                self.log_test("Create Race on Non-existent Circuit (Should Fail)", False, f"Expected 404, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Race on Non-existent Circuit (Should Fail)", False, f"Exception: {str(e)}")
        return False

    def test_get_all_races(self):
        """Test 12: Get All Races"""
        try:
            response = self.make_request("GET", "/races")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) >= 1:  # Should have at least our race
                    self.log_test("Get All Races", True, f"Retrieved {len(data)} races")
                    return True
                else:
                    self.log_test("Get All Races", False, f"Expected list with races, got: {type(data)}", data)
            else:
                self.log_test("Get All Races", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get All Races", False, f"Exception: {str(e)}")
        return False

    def test_filter_races_by_status(self):
        """Test 13: Filter Races by Status"""
        try:
            response = self.make_request("GET", "/races?status=waiting")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    all_waiting = all(r.get("status") == "waiting" for r in data)
                    if all_waiting or len(data) == 0:
                        self.log_test("Filter Races by Status", True, f"Retrieved {len(data)} waiting races")
                        return True
                    else:
                        self.log_test("Filter Races by Status", False, "Some races are not in waiting status", data)
                else:
                    self.log_test("Filter Races by Status", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_test("Filter Races by Status", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Filter Races by Status", False, f"Exception: {str(e)}")
        return False

    def test_join_race(self):
        """Test 14: Join Race (create second user first)"""
        # First create a second user
        import time
        timestamp = int(time.time())
        second_user_data = {
            "email": f"racer.jane.{timestamp}@example.com",
            "password": "SecurePass456!",
            "name": "Jane Racer"
        }
        self.second_user_email = second_user_data["email"]
        
        original_token = self.auth_token
        try:
            response = self.make_request("POST", "/auth/register", second_user_data)
            if response.status_code != 200:
                self.log_test("Join Race", False, "Failed to create second user for testing", response.text)
                return False
                
            second_user_token = response.json()["access_token"]
            self.auth_token = second_user_token
            
            # Now try to join the race
            if not hasattr(self, 'race_id'):
                self.log_test("Join Race", False, "No race ID available from previous tests")
                return False
                
            response = self.make_request("POST", f"/races/{self.race_id}/join")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Join Race", True, f"Successfully joined race: {self.race_id}")
                    success = True
                else:
                    self.log_test("Join Race", False, "Missing success message", data)
                    success = False
            else:
                self.log_test("Join Race", False, f"Status: {response.status_code}", response.text)
                success = False
                
        except Exception as e:
            self.log_test("Join Race", False, f"Exception: {str(e)}")
            success = False
        finally:
            # Restore original token
            self.auth_token = original_token
            
        return success

    def test_join_nonexistent_race(self):
        """Test 26: Join non-existent race should fail"""
        try:
            response = self.make_request("POST", "/races/nonexistent-race-id-12345/join")
            
            if response.status_code == 404:
                self.log_test("Join Non-existent Race (Should Fail)", True, "Correctly rejected non-existent race")
                return True
            else:
                self.log_test("Join Non-existent Race (Should Fail)", False, f"Expected 404, got {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Join Non-existent Race (Should Fail)", False, f"Exception: {str(e)}")
        return False

    def test_start_race(self):
        """Test 15: Start Race (only creator should be able to start)"""
        if not hasattr(self, 'race_id'):
            self.log_test("Start Race", False, "No race ID available from previous tests")
            return False
            
        try:
            response = self.make_request("POST", f"/races/{self.race_id}/start")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Start Race", True, f"Successfully started race: {self.race_id}")
                    return True
                else:
                    self.log_test("Start Race", False, "Missing success message", data)
            else:
                self.log_test("Start Race", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Start Race", False, f"Exception: {str(e)}")
        return False

    def test_get_race_leaderboard(self):
        """Test 16: Get Race Leaderboard"""
        if not hasattr(self, 'race_id'):
            self.log_test("Get Race Leaderboard", False, "No race ID available from previous tests")
            return False
            
        try:
            response = self.make_request("GET", f"/races/{self.race_id}/leaderboard")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Race Leaderboard", True, f"Retrieved leaderboard with {len(data)} participants")
                    return True
                else:
                    self.log_test("Get Race Leaderboard", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_test("Get Race Leaderboard", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Race Leaderboard", False, f"Exception: {str(e)}")
        return False

    def test_send_friend_request(self):
        """Test 17: Send Friend Request by Email"""
        test_data = {
            "friend_email": self.second_user_email  # The second user we created
        }
        
        try:
            response = self.make_request("POST", "/friends/request", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Send Friend Request", True, "Successfully sent friend request")
                    return True
                else:
                    self.log_test("Send Friend Request", False, "Missing success message", data)
            else:
                self.log_test("Send Friend Request", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Send Friend Request", False, f"Exception: {str(e)}")
        return False

    def test_get_friends_list(self):
        """Test 18: Get Friends List"""
        try:
            response = self.make_request("GET", "/friends")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Friends List", True, f"Retrieved {len(data)} friend entries")
                    if len(data) > 0:
                        self.friend_request_id = data[0]["id"]
                    return True
                else:
                    self.log_test("Get Friends List", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_test("Get Friends List", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Friends List", False, f"Exception: {str(e)}")
        return False

    def test_accept_friend_request(self):
        """Test 19: Accept Friend Request"""
        if not hasattr(self, 'friend_request_id'):
            self.log_test("Accept Friend Request", False, "No friend request ID available from previous tests")
            return False
            
        # Switch to the second user to accept the request
        second_user_data = {
            "email": self.second_user_email,
            "password": "SecurePass456!"
        }
        
        try:
            # Login as second user
            response = self.make_request("POST", "/auth/login", second_user_data)
            if response.status_code != 200:
                self.log_test("Accept Friend Request", False, "Failed to login as second user", response.text)
                return False
                
            second_user_token = response.json()["access_token"]
            original_token = self.auth_token
            self.auth_token = second_user_token
            
            # Accept the friend request
            response = self.make_request("POST", f"/friends/{self.friend_request_id}/accept")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Accept Friend Request", True, "Successfully accepted friend request")
                    success = True
                else:
                    self.log_test("Accept Friend Request", False, "Missing success message", data)
                    success = False
            else:
                self.log_test("Accept Friend Request", False, f"Status: {response.status_code}", response.text)
                success = False
                
        except Exception as e:
            self.log_test("Accept Friend Request", False, f"Exception: {str(e)}")
            success = False
        finally:
            # Restore original token
            self.auth_token = original_token
            
        return success

    def test_create_group(self):
        """Test 20: Create Group with Members"""
        # We need the second user's ID, let's get it by logging in as them
        second_user_data = {
            "email": "racer.jane@example.com",
            "password": "SecurePass456!"
        }
        
        try:
            # Login as second user to get their ID
            response = self.make_request("POST", "/auth/login", second_user_data)
            if response.status_code != 200:
                self.log_test("Create Group", False, "Failed to get second user ID", response.text)
                return False
                
            second_user_id = response.json()["user"]["id"]
            
            # Create group with both users
            test_data = {
                "name": "Racing Buddies",
                "member_ids": [second_user_id]
            }
            
            response = self.make_request("POST", "/groups", test_data)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "name" in data and "members" in data:
                    self.group_id = data["id"]
                    self.log_test("Create Group", True, f"Created group: {data['name']} with {len(data['members'])} members")
                    return True
                else:
                    self.log_test("Create Group", False, "Missing required group fields", data)
            else:
                self.log_test("Create Group", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Create Group", False, f"Exception: {str(e)}")
        return False

    def test_get_groups(self):
        """Test 21: Get All Groups for Current User"""
        try:
            response = self.make_request("GET", "/groups")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Groups", True, f"Retrieved {len(data)} groups")
                    return True
                else:
                    self.log_test("Get Groups", False, f"Expected list, got: {type(data)}", data)
            else:
                self.log_test("Get Groups", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Groups", False, f"Exception: {str(e)}")
        return False

    def test_delete_circuit(self):
        """Test 10: Delete Circuit (only owner should be able to delete)"""
        if not hasattr(self, 'private_circuit_id'):
            self.log_test("Delete Circuit", False, "No private circuit ID available from previous tests")
            return False
            
        try:
            response = self.make_request("DELETE", f"/circuits/{self.private_circuit_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_test("Delete Circuit", True, f"Successfully deleted circuit: {self.private_circuit_id}")
                    return True
                else:
                    self.log_test("Delete Circuit", False, "Missing success message", data)
            else:
                self.log_test("Delete Circuit", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Delete Circuit", False, f"Exception: {str(e)}")
        return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🏁 Starting Real-World Racing App Backend API Tests")
        print("=" * 60)
        
        # Authentication Tests
        print("\n🔐 AUTHENTICATION TESTS")
        print("-" * 30)
        self.test_user_registration()
        self.test_user_login()
        self.test_get_current_user()
        
        # Circuit Tests
        print("\n🏎️ CIRCUIT TESTS")
        print("-" * 30)
        self.test_create_public_circuit()
        self.test_create_private_circuit()
        self.test_get_all_circuits()
        self.test_get_public_circuits()
        self.test_get_private_circuits()
        self.test_get_circuit_by_id()
        self.test_delete_circuit()
        
        # Race Tests
        print("\n🏁 RACE TESTS")
        print("-" * 30)
        self.test_create_race()
        self.test_get_all_races()
        self.test_filter_races_by_status()
        self.test_join_race()
        self.test_start_race()
        self.test_get_race_leaderboard()
        
        # Friend Tests
        print("\n👥 FRIEND TESTS")
        print("-" * 30)
        self.test_send_friend_request()
        self.test_get_friends_list()
        self.test_accept_friend_request()
        
        # Group Tests
        print("\n👨‍👩‍👧‍👦 GROUP TESTS")
        print("-" * 30)
        self.test_create_group()
        self.test_get_groups()
        
        # Error Handling Tests
        print("\n❌ ERROR HANDLING TESTS")
        print("-" * 30)
        self.test_duplicate_registration()
        self.test_wrong_password_login()
        self.test_unauthorized_access()
        self.test_create_race_nonexistent_circuit()
        self.test_join_nonexistent_race()
        
        # Summary
        print("\n📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests, self.test_results


def main():
    """Main function to run the tests"""
    # Get backend URL from environment
    backend_url = "https://roadrally.preview.emergentagent.com"
    
    print(f"Testing backend at: {backend_url}")
    
    tester = RacingAppTester(backend_url)
    passed, failed, results = tester.run_all_tests()
    
    # Save detailed results to file
    with open("/app/test_results_detailed.json", "w") as f:
        json.dump({
            "summary": {
                "total": len(results),
                "passed": passed,
                "failed": failed,
                "success_rate": (passed/len(results))*100
            },
            "results": results
        }, f, indent=2, default=str)
    
    print(f"\nDetailed results saved to: /app/test_results_detailed.json")
    
    return passed == len(results)  # Return True if all tests passed


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)