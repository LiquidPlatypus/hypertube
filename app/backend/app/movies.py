from fastapi import FastAPI, HTTPException, status, Query, APIRouter
from fastapi.responses import JSONResponse
import requests
import tmdbsimple as tmdb
# from auth import tmdb
import os

router = APIRouter()

# tmdb.API_KEY = os.getenv("TMDB_API_KEY")
# tmdb.REQUESTS_TIMEOUT = 5
# BITSEARCH_API_KEY = os.getenv("BITSEARCH_API_KEY")

@router.get("/api/thumbnails", response_class=JSONResponse)
def get_thumbnails(query: str = Query(None, min_length=1), page: int = Query(1, ge=1)):
    """
    Get a list of movies thumbnails from TMDB API. params: query (str), page (int) \n
    If query is provided, search for movies matching the query. Else, get popular movies (updated daily). \n
    20 movies are returned per page.
    Returns a list of dictionaires with keys: id, title, poster_path, release_date, score.
    """
    thumbnails_data = []
    if query and len(query) >= 1:
        # search using query, then select only movies
        search = tmdb.Search()
        thumbnails_search_results = search.movie(query=query, page=page)
    else:
        # no query, get popular movies (updated daily)
        thumbnails_search_results = tmdb.Movies().popular(page=page)

    for movie in thumbnails_search_results["results"]:
        thumbnails_data.append({
            "id": movie["id"],
            "title": movie["original_title"],
            "poster_path": f"https://image.tmdb.org/t/p/w500{movie['poster_path']}",
            "release_date": movie["release_date"],
            "score": movie["vote_average"]
        })
    return JSONResponse(content=thumbnails_data)

@router.get("/api/movie/{movie_id}", response_class=JSONResponse)
def get_movie_details(movie_id: int):
    """
    Get detailed information about a movie from TMDB API. \n
    Returns a dictionaire with keys: title, tagline, overview, poster_path, release_date, runtime, score, \n
    and cast (list of dictionaires with keys: actor_name, character_name, actor_picture).
    """
    movie_data = {}
    movie_search_results = tmdb.Movies(movie_id).info()
    creddits_search_results = tmdb.Movies(movie_id).credits()

    movie_data["id"] = movie_id
    movie_data["title"] = movie_search_results["original_title"]
    movie_data["tagline"] = movie_search_results["tagline"]
    movie_data["overview"] = movie_search_results["overview"]
    movie_data["poster_path"] = f"https://image.tmdb.org/t/p/w500{movie_search_results['poster_path']}"
    movie_data["release_date"] = movie_search_results["release_date"]
    movie_data["runtime"] = movie_search_results["runtime"]
    movie_data["score"] = movie_search_results["vote_average"]
    cast_data = []
    for actor in creddits_search_results["cast"][:5]:
        cast_data.append({
            "actor_name": actor["name"],
            "character_name": actor["character"],
            "actor_picture_path": f"https://image.tmdb.org/t/p/w500{actor['profile_path']}"
        })
    movie_data["cast"] = cast_data

    return JSONResponse(content=movie_data)