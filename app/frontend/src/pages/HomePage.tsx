import React, { useState, useEffect, useCallback } from "react";
import { data, useNavigate } from "react-router-dom";

export interface User {
	"user": {
		"id": number,
		"username": string,
		"email": string,
		"firstname": string,
		"lastname": string,
	}
}

interface Comment {
	"id": number;
	"content": string;
	"author": string;
	"date": string;
}

export default function HomePage() {
	const [user_info, setUserInfo] = useState("");
	const [username, setUsername] = useState("");
	const [firstname, setFirstname] = useState("");
	const [lastname, setLastname] = useState("");
	const [email, setEmail] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [profilePic, setProfilePic] = useState<string | null>(null);
	const navigate = useNavigate();
	const [comment, setComment] = useState("");
	const [comments, setComments] = useState<Map<number, Comment>>(new Map());
	const [chunk, setChunk] = useState(0);
	const [loading, setLoading] = useState<boolean>(false);
	const [isEmpty, setIsEmpty] = useState<boolean>(false);
	const observer = React.useRef<IntersectionObserver | null>(null);

	const testGetUserInfo = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			const token = localStorage.getItem("access_token");
			const response = await fetch("/api/me", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) {
				throw new Error("Not authorized");
			}
			const data: User = await response.json();
			setUserInfo(`${data.user.email}//${data.user.firstname}//${data.user.lastname}//${data.user.username}`);
		} catch (error) {
			setUserInfo("Error")
		}
	};

	const testModifyProfile = async (e: React.MouseEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const token = localStorage.getItem("access_token");
			const response = await fetch("/api/modify-profile", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ username, email, firstname, lastname }),
			});
			if (!response.ok) {
				throw new Error("Not authorized");
			}
			const data: {returnValue: Boolean} = await response.json();
			console.log(data.returnValue);
		} catch (error) {
			console.error("Error in modify form");
		}
	};

	const testMessage = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			const response = await fetch("/api/hello", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!response.ok) {
				throw new Error("Server error");
			}
			const data: {message: string} = await response.json();
			console.log(data.message);
		} catch (error) {
			console.error("Error server");
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files)
			setFile(e.target.files[0]);
	};

	const handleProfilePic = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!file) return;
		const formData = new FormData();
		formData.append("file", file);
		const token = localStorage.getItem("access_token");

		try {
			const response = await fetch("/api/upload-picture", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: formData,
			});
			if (!response.ok)
				throw new Error("Server error");
			const data: {returnValue: boolean} = await response.json();
			if (data.returnValue === true)
				setUserInfo("Profile Picture Uploaded !")
		} catch (error) {
			console.error(error);
		}
	};

	const getProfilePicture = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		const token = localStorage.getItem("access_token");

		try {
			const response = await fetch("/api/me/profile-pic", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok)
				throw new Error("Server Error");
			if (response.headers.get("Content-Type")?.includes("application/json")) {
				const data = await response.json();
				console.log(data);
				setProfilePic(data);
			} else {
				const blob = await response.blob();
				if (blob.type === "application/json") {
					setUserInfo("Have not profile pic");
					return;
				}
				const imageURL = URL.createObjectURL(blob);
				setProfilePic(imageURL);
			}
		} catch (error) {
			console.error(error);
		}
	};

	const logout = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			localStorage.removeItem("access_token");
			navigate('/auth/login');
		} catch (error) {
			console.error("Error server");
		}
	};

	
	const postComment = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const token = localStorage.getItem("access_token");
		try {
			const content = comment;
			const response = await fetch("/api/comments", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content }),
			});
			if (!response.ok)
				throw new Error("Server Error");
			const res = await response.json();
			const data: Comment = res.comment;
			setComments(prevSelf => {
				const clone = new Map(prevSelf);
				clone.set(data.id, data);
				return clone;
			});
		} catch (error) {
			console.error(error);
			setComment("Error server");
		}
	}

	const getComments = async () => {
		setLoading(true);

		const token = localStorage.getItem("access_token");
		try {
			const response = await fetch(`/api/comments?pos=${chunk}`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok)
				throw new Error(`Server Error :${response.status}`);
			const res = await response.json();
			const data: Comment[] = res.comments
			if (data.length === 0 || !data.length)
				setIsEmpty(true);
			else
				setIsEmpty(false)
			for (const it in data) {
				setComments(prevSelf => {
					const clone = new Map(prevSelf);
					if (clone.get(data[it].id))
						return clone;
					clone.set(data[it].id, data[it]);
					return clone;
				});
			}
			setChunk(chunk + 10);
		} catch (error) {
			console.error(error);
			setComment("Error server");
		} finally {
			setLoading(false);
		}
	}

	const observerTrigger = async () => {
		if (loading) return
		setChunk(chunk + 10);
		getComments();
	}
    const lastComment = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();		// disconect observer when it doing verification

        observer.current = new IntersectionObserver(entries => {	// entries is array of observed element
            if (entries[0].isIntersecting && !isEmpty) {			// isIntersecting set on True if element is visible
				observerTrigger();									// function to refill comments map
            }
        });
        if (node) observer.current.observe(node);					// define the node (html element of the last comment) to be observed
    }, [loading, isEmpty]);

	useEffect(() => {
		getComments();
	}, []);

	return (
		<div>
			<button onClick={testMessage}>Hello</button>

			{profilePic && <img src={profilePic} alt="Profile" />}
			<button onClick={getProfilePicture}>Get IMG</button>

			<h3>{user_info}</h3>
			{/* <button onClick={testGetUserInfo}>Click me</button> */}

				<div>
					<form onSubmit={handleProfilePic}>
						<label htmlFor="profile-pic">Select image :</label>
						<input type="file" accept="image/*" onChange={handleFileChange} required />
						<button type="submit">Upload</button>
					</form>
				</div>
				<form onSubmit={testModifyProfile}>
					<label htmlFor="username">Enter username :</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Username"
						required
					/>
					<label htmlFor="email">Enter email :</label>
					<input
						id="email"
						type="text"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						required
					/>
					<label htmlFor="firstname">Enter firstname :</label>
					<input
						id="firstname"
						type="text"
						value={firstname}
						onChange={(e) => setFirstname(e.target.value)}
						placeholder="firstname"
						required
					/>
					<label htmlFor="lastname">Enter lastname :</label>
					<input
						id="lastname"
						type="text"
						value={lastname}
						onChange={(e) => setLastname(e.target.value)}
						placeholder="lastname"
						required
					/>
					<button type="submit">Send</button>
				</form>
				<button onClick={testGetUserInfo}>Click me</button>
				<button onClick={logout}>Logout</button>
				<div>
					<h1>COMMENT PART:</h1>
					<form onSubmit={postComment}>
						<label htmlFor="comment">Enter comment :</label>
						<input
							id="comment"
							type="text"
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							placeholder="your comment"
							required
						/>
						<button type="submit">submit</button>
					</form>
					{/* <button onClick={observerTrigger}>get more comment</button> */}
					{Array.from(comments.entries()).map(([id, comment], index, array) => {
						const isLast = index === array.length - 1;
						if (!id)
							return (
								<p>Comment list is Empty</p>
							);
						return (
							<div
								key={id}
								ref={isLast ? lastComment : null}
							>
								<p>
									{comment.author}: {comment.content}
								</p>
							</div>
						);
					})}
				</div>
		</div>
	);
}