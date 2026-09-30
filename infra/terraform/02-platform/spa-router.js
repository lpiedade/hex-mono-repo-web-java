// CloudFront viewer-request function: the static-serving rules the SPA needs
// (ADR-017, ADR-025). A CloudFront custom error response is distribution-wide
// and cannot tell a missing hashed bundle from a client-side route, which is
// why this is a function.
//
// Rendered by Terraform's templatefile(), which fills in the base path below.
// The BFF's routes never reach this function - they are separate cache
// behaviours in cloudfront.tf.
//
// Runtime is cloudfront-js-2.0. It is not Node: no require, no async, and the
// string helpers are the ES5 ones - hence indexOf rather than startsWith.
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var base = '/${base}';

    // The site root and the bare base path redirect to the base path with a
    // trailing slash.
    if (uri === '/' || uri === base) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: base + '/' } }
        };
    }

    // Hashed asset bundles are content-addressed: a stale URL must fail
    // honestly with the origin's own 404, never with the SPA shell. Passing
    // the request through unchanged is what produces that.
    if (uri.indexOf(base + '/assets/') === 0) {
        return request;
    }

    // Anything else under the base path is a client-side route: React Router
    // owns navigation, so serve the shell. A path whose last segment carries a
    // dot is treated as a real file and left alone.
    if (uri.indexOf(base + '/') === 0) {
        var segments = uri.split('/');
        var last = segments[segments.length - 1];
        if (last.indexOf('.') === -1) {
            request.uri = base + '/index.html';
        }
    }

    return request;
}
