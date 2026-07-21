import sys
import requests

HEADER = '\033[95m'
OKBLUE = '\033[94m'
OKCYAN = '\033[96m'
OKGREEN = '\033[92m'
WARNING = '\033[93m'
FAIL = '\033[91m'
ENDC = '\033[0m'
BOLD = '\033[1m'
UNDERLINE = '\033[4m'

# print(WARNING + "\nBe sur to make cleandb and clean or fclean before continue" + ENDC)
# input("Press ENTER to continue")
# print()

class User:
    def __init__(self, u, p, e, f, l):
        self.username = u
        self.password = p
        self.email = e
        self.firstname = f
        self.lastname = l
user1 = User("user1", "user1", "user1@gmail.com", "u1F", "u1L")
user1_fail = User("user1", "fail", "user1@gmail.com", "u1F", "u1L")
base_url = "http://localhost:8000/api"
access_token = None

get_tests = {
    f"{base_url}/users": None,
    f"{base_url}/comments": None,
}

def post_url(url: str, header: str = None, body: str = None):
    print(HEADER + f"trying: {url}..." + ENDC)
    try:
        if header:
            response = requests.post(url, json=body, headers=header)
        else:
            response = requests.post(url, json=body)
        if response.status_code == 200:
            data = response.json()
            return(data)
        else:
            print(FAIL + f"Code error : {response.status_code}\n" + WARNING + f"details : {response.text}" + ENDC)
    except requests.exceptions.ConnectionError:
        print(FAIL + "💥 Impossible de contacter le serveur. Es-tu sûr qu'il tourne sur le bon port ?" + ENDC)
    except Exception as e:
        print(FAIL + f"💥 Une erreur inattendue est survenue : {e}" + ENDC)
    return(None)

def get_url(url: str, header: str = None):
    print(HEADER + f"trying: {url}..." + ENDC)
    try:
        response = requests.get(url, headers=header)
        if response.status_code == 200:
            data = response.json()
            return(data)
        else:
            print(FAIL + f"Code error : {response.status_code}\n" + WARNING + f"details : {response.text}" + ENDC)
    except requests.exceptions.ConnectionError:
        print(FAIL + "💥 Impossible de contacter le serveur. Es-tu sûr qu'il tourne sur le bon port ?" + ENDC)
    except Exception as e:
        print(FAIL + f"💥 Une erreur inattendue est survenue : {e}" + ENDC)
    return(None)

print("TRYING METHOD POST")
try:
    list_of_user = [user1, user1_fail]
    for u in list_of_user:
        data = post_url(url=f"{base_url}/oauth/token", body={"provider": "register", "username": u.username, "password": u.password, "email": u.email, "firstName": u.firstname, "lastName": u.lastname})
        access_token = data['access_token']
        if access_token:
            print(OKCYAN + "res: access_token generated\n" + ENDC)
        else:
            print(FAIL + "res: no user created\n" + ENDC)
except (ValueError, TypeError):
    print()

if access_token:
    get_tests[f"{base_url}/users/1"] = { "Authorization": f"Bearer {access_token}" }
    get_tests[f"{base_url}/users/user1"] = { "Authorization": f"Bearer {access_token}" }
    get_tests[f"{base_url}/users/2"] = { "Authorization": f"Bearer {access_token}" }

print("TRYING METHOD GET")
for t in get_tests:
    data = get_url(t, get_tests[t])
    if not data:
        print("\n")
        continue
    print(OKCYAN + f"res: {data}\n" + ENDC)

print("TRYING COMMENT CALL")
if access_token:
    headers = {'Authorization': f'Bearer ${access_token}', "Content-Type": "application/json"}
data = get_url(url=f"{base_url}/comments")
print("\n" if not data else OKCYAN + f"res: {data}\n" + ENDC)
data = get_url(url=f"{base_url}/comments/1")
print("\n" if not data else OKCYAN + f"res: {data}\n" + ENDC)
