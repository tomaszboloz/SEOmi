use objc2::{
    exception::{catch, throw, Exception},
    msg_send,
    rc::{autoreleasepool, Retained},
    runtime::{AnyClass, AnyObject},
};
use std::panic::AssertUnwindSafe;

#[link(name = "Foundation", kind = "framework")]
unsafe extern "C" {}

/// Exercise the same Objective-C exception boundary Wry uses for cancelled
/// WKURLSchemeTasks. Run in both actual desktop profiles: a unit-test binary's
/// unwind policy alone cannot prove that the production profile can catch it.
pub fn assert_catchable_navigation_exception() {
    autoreleasepool(|_| {
        // SAFETY: Foundation owns these classes; the strings and exception are
        // retained for the complete synchronous throw/catch round trip.
        let exception: Retained<Exception> = unsafe {
            let name: Retained<AnyObject> = msg_send![
                AnyClass::get(c"NSString").expect("Foundation NSString"),
                stringWithUTF8String: c"SEOmiNavigationProbe".as_ptr()
            ];
            let reason: Retained<AnyObject> = msg_send![
                AnyClass::get(c"NSString").expect("Foundation NSString"),
                stringWithUTF8String: c"WebView navigation cancelled".as_ptr()
            ];
            msg_send![
                AnyClass::get(c"NSException").expect("Foundation NSException"),
                exceptionWithName: &*name,
                reason: &*reason,
                userInfo: std::ptr::null::<AnyObject>()
            ]
        };
        let result = catch(AssertUnwindSafe(|| throw(exception)));
        let caught = result
            .expect_err("navigation exception must reach its Objective-C handler")
            .expect("navigation exception must retain its reason");
        assert_eq!(caught.to_string(), "WebView navigation cancelled");
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn catches_the_platform_navigation_exception() {
        super::assert_catchable_navigation_exception();
    }
}
