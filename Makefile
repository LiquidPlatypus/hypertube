RED=\033[31m
YEL=\033[33m
CYA=\033[36m
STOP=\033[0m

all: 
	@echo "$(CYA)=== Building & starting containers...$(STOP)"
	@sudo docker-compose up

build: #Builds all containers
	@echo "$(CYA)=== Building containers...$(STOP)"
	@sudo docker-compose up --build

clean: #Stops and remove all containers volumes and networks
	@echo "$(CYA)=== Stopping and cleaning containers, volumes and networks...$(STOP)"
	@sudo docker-compose down --remove-orphans -v

iclean: #Removes all images
	@echo "$(RED)!!!=== Do you really want to remove all images ?$(STOP)"
	@read -p "Confirm (y/n) : " confirm && [ "$$confirm" = "y" ] || (echo "$(YEL)Aborted.$(STOP)" && exit 1)
	@echo "$(CYA)=== Cleaning images...$(STOP)"
	@sudo docker rmi -f $$(sudo docker images -qa);

cleandb: #Removes database data only
	@echo "$(RED)!!!=== Do you really want to remove database data ?\n$(YEL) /!\ This will delete all persisted data (keys, users, scores...) /!\ $(STOP)"
	@read -p "Confirm (y/n) : " confirm && [ "$$confirm" = "y" ] || (echo "$(YEL)Aborted.$(STOP)" && exit 1)
	@echo "$(CYA)=== Cleaning database data...$(STOP)"
	@sudo rm -rf mariadb/data

fclean: #Removes everything
	@echo "$(RED)!!!=== Do you really want to remove all data ?\n$(YEL) /!\ This will delete all persisted data (keys, users, scores...) /!\ $(STOP)"
	@read -p "Confirm (y/n) : " confirm && [ "$$confirm" = "y" ] || (echo "$(YEL)Aborted.$(STOP)" && exit 1)
	@echo "$(CYA)=== Cleaning data...$(STOP)"
	@make clean
	@sudo docker system prune -a --volumes
	@echo "$(CYA)=== Removing files...$(STOP)"
	@sudo rm -rf mariadb/data
	@sudo rm -rf  app/frontend/dist 

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