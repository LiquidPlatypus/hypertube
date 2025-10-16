RED=\033[31m
YEL=\033[33m
CYA=\033[36m
STOP=\033[0m

all: #Builds, then starts all containers. Entrypoint of Hypertube
	@echo "$(CYA)=== Composing Hypertube...$(STOP)"
	@sudo docker-compose up --build
	@sudo docker-compose logs -f app

clean: #Stops and remove all containers volumes and networks
	@echo "$(CYA)=== Stopping and cleaning containers, volumes and networks...$(STOP)"
	@sudo docker stop $$(sudo docker ps -qa);\
	 sudo docker rm $$(sudo docker ps -qa);\
	 sudo docker volume rm $$(sudo docker volume ls -q);\
	 sudo docker network rm $$(sudo docker network ls -q)\

iclean: #Removes all images
	@echo "$(RED)!!!=== Do you really want to remove all images ?$(STOP)"
	@read -p "Confirm (y/n) : " confirm && [ "$$confirm" = "y" ] || (echo "$(YEL)Aborted.$(STOP)" && exit 1)
	@echo "$(CYA)=== Cleaning images...$(STOP)"
	@sudo docker rmi -f $$(sudo docker images -qa);

fclean: #Removes everything
	@echo "$(RED)!!!=== Do you really want to remove all data ?\n$(YEL) /!\ This will delete all persisted data (keys, users, scores...) /!\ $(STOP)"
	@read -p "Confirm (y/n) : " confirm && [ "$$confirm" = "y" ] || (echo "$(YEL)Aborted.$(STOP)" && exit 1)
	@echo "$(CYA)=== Cleaning data...$(STOP)"
	@sudo rm -rf \
		postgresql/data \
		postgresql/postgresql-init/* \
		postgresql/tls/* \
	@make mclean
	@make clean

list: #Lists all containers, images, volumes and networks. Running or not, used or not.
	@echo "\n$(CYA)======== CONTAINERS ========$(STOP)"
	@sudo docker ps -a
	@echo "\n$(CYA)======== IMAGES ============$(STOP)"
	@sudo docker images -a
	@echo "\n$(CYA)======== VOLUMES ===========$(STOP)"
	@sudo docker volume ls
	@echo "\n$(CYA)======== NETWORKS ==========$(STOP)"
	@sudo docker network ls

.PHONY: all start stop clean iclean fclean lsit