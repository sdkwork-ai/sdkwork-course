use std::sync::Arc;

use sdkwork_content_course_service::{CourseApplicationService, QuestionBankService};

#[derive(Clone)]
pub struct CourseAppApiState {
    service: Arc<dyn CourseApplicationService>,
    question_bank_service: Arc<dyn QuestionBankService>,
}

impl CourseAppApiState {
    pub fn new(
        service: Arc<dyn CourseApplicationService>,
        question_bank_service: Arc<dyn QuestionBankService>,
    ) -> Self {
        Self {
            service,
            question_bank_service,
        }
    }

    pub fn service(&self) -> Arc<dyn CourseApplicationService> {
        Arc::clone(&self.service)
    }

    pub fn question_bank_service(&self) -> Arc<dyn QuestionBankService> {
        Arc::clone(&self.question_bank_service)
    }
}
