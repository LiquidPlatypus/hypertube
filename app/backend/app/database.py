class Storage:
	def __init__(self):
		self.users = []
		self.password = []

	def add_user(self, username: str, email: str, password: str, firstname: str, lastname: str):
		"""
		DESK:
		Take all information and set in objet user before storaged in DB
		\n/!\\ PASSWORD NOT HASHED
		"""
		user = {"id": len(self.users) + 1, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(user)

		self.password.append({"user_id": user["id"], "password": password})
		return user

	def get_user_by_id(self, user_id: int):
		"""
		DESK:
		Get an user id and return corresponding objet
		"""
		for u in self.users:
			if u["id"] == user_id:
				return u
		return None

	def modify_user(self, username: str, email: str, firstname: str, lastname: str, user_id: int):
		"""
		DESK:
		Remove user corresponding of gived id, and recreate with new info + old id
		"""
		for u in self.users:
			if u["id"] == user_id:
				self.users.remove(u)
				break
		new_user = {"id": user_id, "username": username, "email": email, "firstname": firstname, "lastname": lastname}
		self.users.append(new_user)

	def get_user_password(self, user_id: int):
		"""
		DESK:
		Get an user id and return corresponding password
		\n/!\\ PASSWORD NOT HASHED
		"""
		for p in self.password:
			if p["user_id"] == user_id:
				return p["password"]
		return None

	def get_all_users(self):
		"""
		DESK:
		Return list of user (without password)
		"""
		return self.users
	

	def modify_password(self, new_password: str, user_id: int):
		"""
		DESK:
		Remove old password and replace it by the new
		"""
		for p in self.password:
			if p["user_id"] == user_id:
				self.password.remove(p)
				self.password.append({"user_id": user_id, "password": new_password})
		return None