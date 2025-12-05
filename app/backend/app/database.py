import datetime
class Storage:
	def __init__(self):
		self.users = []
		self.password = []
		self.profile_pic = []
		self.comments = []

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
	
	def add_profile_pic(self, user_id: int, image_url: str):
		"""
		DESK:
		Set in db new image profile and replace old by new
		"""
		for i in self.profile_pic:
			if i["user_id"] == user_id:
				self.profile_pic.remove(i)
		self.profile_pic.append({"user_id": user_id, "image_url": image_url})
	
	def get_profile_pic(self, user_id: int):
		"""
		DESK:
		Return URL of user image or None if he haven't
		"""
		for i in self.profile_pic:
			if i["user_id"] == user_id:
				return i["image_url"]
		return None
	
	def add_comment(self, content: str, author: str):
		"""
		DESK:
		Set in DB the comment and metadata of this
		date : mm/jj/aaaa : must be an array of int: 0[mm], 1[jj], 2[aaaa]
		author : author username
		"""
		date = datetime.datetime.now()
		comment = {"id": len(self.comments) + 1, "content": content, "author": author, "date": date}
		self.comments.append(comment)
		return comment
	
	def get_comment(self, id):
		for i in self.comments:
			if i["id"] == id:
				return i
		return None

	def custom_comment(self, id: int, new_content: str):
		for i in self.comments:
			if i["id"] == id:
				comment = {"id": i["id"], "content": new_content, "author": i["author"], "date": i["date"]}
				self.comments.remove(i)
				self.comments.append(comment)
				return comment
		return None

	def get_comments(self):
		return self.comments

storage = Storage()