#!/bin/sh
set -e

echo "Starting arq worker..."
exec python -m arq apps.api.jobs.worker.WorkerSettings
