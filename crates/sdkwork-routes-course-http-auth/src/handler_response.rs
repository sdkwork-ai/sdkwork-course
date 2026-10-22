use axum::response::Response;
use sdkwork_content_course_service::CourseQuery;
use sdkwork_web_core::WebRequestContext;
use serde_json::Value;

use crate::api_response::{success_command, success_item, success_items};

pub fn handler_value_to_response(
    context: Option<&WebRequestContext>,
    value: Value,
    query: Option<&CourseQuery>,
) -> Response {
    if value.is_null() {
        return success_command(context, None, None);
    }

    if let Some(items) = value.as_array() {
        let page = query.map(|q| q.page.unwrap_or(1)).unwrap_or(1);
        let page_size = query.map(CourseQuery::limit).unwrap_or(20);
        return success_items(context, items.clone(), page, page_size, None);
    }

    if let Some(object) = value.as_object() {
        if object.contains_key("items") {
            let items = object
                .get("items")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let page = object
                .get("page")
                .and_then(Value::as_i64)
                .or_else(|| query.map(|q| q.page.unwrap_or(1)))
                .unwrap_or(1);
            let page_size = object
                .get("pageSize")
                .or_else(|| object.get("page_size"))
                .and_then(Value::as_i64)
                .or_else(|| query.map(CourseQuery::limit))
                .unwrap_or(20);
            let total = object.get("total").and_then(Value::as_i64);
            return success_items(context, items, page, page_size, total);
        }

        if object.len() == 1 {
            let resource_id = object
                .get("enrollmentId")
                .or_else(|| object.get("offeringId"))
                .or_else(|| object.get("categoryId"))
                .or_else(|| object.get("courseId"))
                .or_else(|| object.get("lessonId"))
                .or_else(|| object.get("liveSessionId"))
                .or_else(|| object.get("resourceId"))
                .and_then(Value::as_str)
                .map(str::to_owned);
            if resource_id.is_some() {
                return success_command(context, resource_id, None);
            }
        }
    }

    success_item(context, value)
}
