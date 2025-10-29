class Storage:
	def __init__(self):
		self.users = []
		self.password = []

	def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str):
		user = {"id": len(self.users) + 1, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(user)

		self.password.append({"user_id": user["id"], "password": password})
		return user

	def get_user_by_id(self, user_id: int):
		for u in self.users:
			if u["id"] == user_id:
				return u
		return None

	def modify_user(self, username: str, email: str, firstname: str, lastname: str, user_id: int):
		for u in self.users:
			if u["id"] == user_id:
				self.users.remove(u)
				break
		new_user = {"id": user_id, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(new_user)

	def get_user_password(self, user_id: int):
		for p in self.password:
			if p["user_id"] == user_id:
				return p["password"]
		return None

	def get_all_users(self):
		return self.users