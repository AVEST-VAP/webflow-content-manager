import { useState, useEffect } from 'react';

interface SiteInfo {
  siteId: string;
  siteName: string;
}

interface UseSiteInfoResult {
  siteInfo: SiteInfo | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch Webflow site info on mount
 * Replaces useEffect + multiple useState pattern
 */
export const useSiteInfo = (): UseSiteInfoResult => {
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchSiteInfo = async () => {
      try {
        const site = await webflow.getSiteInfo();
        if (mounted) {
          setSiteInfo({
            siteId: site.siteId,
            siteName: site.siteName || site.shortName || 'Site',
          });
        }
      } catch (err) {
        console.error('Failed to fetch site info:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch site info');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSiteInfo();

    return () => {
      mounted = false;
    };
  }, []);

  return { siteInfo, loading, error };
};
