import { Bell, BellOff, Smartphone, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    isIOSPWA,
    vapidKeyConfigured,
    toggleSubscription,
  } = usePushNotifications();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:h-10 md:w-10"
          title="Notification Settings"
        >
          {isSubscribed ? (
            <Bell className="h-4 w-4 md:h-5 md:w-5" />
          ) : (
            <BellOff className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </DialogTitle>
          <DialogDescription>
            Get notified when drawings you've scanned receive new revisions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isSupported ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Push notifications are not supported in your browser.
                {isIOS && !isStandalone && (
                  <span className="block mt-2 font-medium">
                    On iOS, you need to add this app to your home screen first.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          ) : !vapidKeyConfigured ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Push notifications are not configured. Please contact your administrator.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {isIOS && !isStandalone && (
                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription>
                    <strong>iOS Users:</strong> To receive notifications, tap the Share button 
                    and select "Add to Home Screen", then open the app from there.
                  </AlertDescription>
                </Alert>
              )}

              {permission === 'denied' && (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Notifications are blocked. Please enable them in your browser/device settings.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications" className="text-base">
                    Drawing Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify me when a scanned drawing is updated
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={isSubscribed}
                  onCheckedChange={toggleSubscription}
                  disabled={isLoading || permission === 'denied'}
                />
              </div>

              {isSubscribed && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium text-primary">
                    ✓ Notifications enabled
                  </p>
                  <p className="text-muted-foreground mt-1">
                    You'll receive alerts when any drawing you've scanned gets a new revision.
                  </p>
                </div>
              )}

              {!isSubscribed && permission !== 'denied' && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">How it works:</p>
                  <ol className="list-decimal list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>Scan a QR code on a shop drawing</li>
                    <li>When that drawing gets updated, you'll be notified</li>
                    <li>Tap the notification to check the latest revision</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
