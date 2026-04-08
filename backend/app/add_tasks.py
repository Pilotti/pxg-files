from app.db.session import SessionLocal
from app.services.task_json_storage import import_task_templates_from_json_files


def main() -> None:
	db = SessionLocal()
	try:
		changed = import_task_templates_from_json_files(db)
		print(f"Sincronizacao de task JSON concluida. Alteracoes aplicadas: {changed}")
	finally:
		db.close()


if __name__ == "__main__":
	main()
