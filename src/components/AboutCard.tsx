import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/i18n-context";

export function AboutCard() {
  const { t } = useI18n();
  
  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold mb-2">{t('about:title')}</h2>
      <Separator className="my-2" />
      <div className="space-y-2 text-sm text-gray-600">
        <p>
          <span className="font-semibold">{t('about:fairness.title')}:</span> {t('about:fairness.description')}
        </p>
        <p>
          <span className="font-semibold">{t('about:legality.title')}:</span> {t('about:legality.description')}
        </p>
        <p>
          <span className="font-semibold">{t('about:placement.title')}:</span> {t('about:placement.description')}
        </p>
        <p>
          <span className="font-semibold">{t('about:analysis.title')}:</span> {t('about:analysis.description')}
        </p>
      </div>
    </Card>
  );
}