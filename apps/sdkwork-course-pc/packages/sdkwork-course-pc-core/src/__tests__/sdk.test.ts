import { getCourseAppSdkClient } from '../courseAppSdkClient';

describe('CourseAppSdkClient', () => {
  it('creates generated SDK with canonical API groups', () => {
    const sdk = getCourseAppSdkClient();
    expect(sdk).toBeDefined();
    expect(sdk.courseCategories).toBeDefined();
    expect(sdk.courses).toBeDefined();
    expect(sdk.courseOfferings).toBeDefined();
    expect(sdk.courseEnrollments).toBeDefined();
    expect(sdk.courseSections).toBeDefined();
    expect(sdk.courseLessons).toBeDefined();
    expect(sdk.courseProgress).toBeDefined();
    expect(sdk.courseReactions).toBeDefined();
    expect(sdk.courseApplications).toBeDefined();
  });

  it('exposes list methods on generated groups', () => {
    const sdk = getCourseAppSdkClient();
    expect(typeof sdk.courseCategories.list).toBe('function');
    expect(typeof sdk.courses.list).toBe('function');
    expect(typeof sdk.courseEnrollments.current.list).toBe('function');
    expect(typeof sdk.courseReactions.update).toBe('function');
  });
});

