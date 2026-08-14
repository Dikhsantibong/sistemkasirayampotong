<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to the shop owner.
 *
 * Guards the server-rendered pages that a kasir must not reach: the financial
 * reports and the screens that change money-sensitive settings. Offline
 * screens cannot be protected this way — their writes are authorised at
 * `/kasir/sync/push` instead, see `SyncPermissions`.
 */
class EnsureUserIsPemilik
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isPemilik() === true, 403, 'Halaman ini hanya untuk pemilik.');

        return $next($request);
    }
}
