from app.routers.health import router as health_router
from app.routers.seed import router as seed_router
from app.routers.auth import router as auth_router
from app.routers.role_dashboards import router as role_dashboards_router
from app.routers.customers import router as customers_router
from app.routers.enquiries import router as enquiries_router
from app.routers.surveys import router as surveys_router
from app.routers.quotations import router as quotations_router
from app.routers.orders import router as orders_router
from app.routers.catalog import router as catalog_router
from app.routers.products import router as products_router
from app.routers.inventory import router as inventory_router
from app.routers.bom_order import router as bom_order_router
from app.routers.dashboard import router as dashboard_router
from app.routers.dispatches import router as dispatches_router
from app.routers.installations import router as installations_router
from app.routers.passports import router as passports_router
from app.routers.warranties import router as warranties_router
from app.routers.service_tickets import router as service_tickets_router
from app.routers.credibility import router as credibility_router
from app.routers.analytics import router as analytics_router
from app.routers.subsidies import router as subsidies_router
from app.routers.notifications import router as notifications_router
from app.routers.documents import router as documents_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.tasks import router as tasks_router
from app.routers.appointments import router as appointments_router
from app.routers.master_data import router as master_data_router
from app.routers.customer_portal import router as customer_portal_router

__all__ = [
    "health_router",
    "seed_router",
    "auth_router",
    "role_dashboards_router",
    "customers_router",
    "enquiries_router",
    "surveys_router",
    "quotations_router",
    "orders_router",
    "catalog_router",
    "products_router",
    "inventory_router",
    "bom_order_router",
    "dashboard_router",
    "dispatches_router",
    "installations_router",
    "passports_router",
    "warranties_router",
    "service_tickets_router",
    "credibility_router",
    "analytics_router",
    "subsidies_router",
    "notifications_router",
    "documents_router",
    "audit_logs_router",
    "tasks_router",
    "appointments_router",
    "master_data_router",
    "customer_portal_router",
]
