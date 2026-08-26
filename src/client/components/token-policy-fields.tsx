import type { TokenPolicy } from "@/shared/types";
import { Input } from "@/components/ui/input";

export function TokenPolicyFields({ value, onChange }: { value: TokenPolicy; onChange: (value: TokenPolicy) => void }) {
  const toggle = (key: keyof TokenPolicy) => onChange({ ...value, [key]: !value[key] });
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">最小长度</span>
        <Input
          type="number"
          min={8}
          max={128}
          value={value.minLength}
          onChange={(event) => onChange({ ...value, minLength: Math.min(128, Math.max(8, Number(event.target.value) || 8)) })}
          className="h-7 w-20 text-center font-mono text-xs"
        />
        <span className="text-2xs text-muted-foreground">最多 128 位</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-muted-foreground">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={value.requireUppercase} onChange={() => toggle("requireUppercase")} />大写字母</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={value.requireLowercase} onChange={() => toggle("requireLowercase")} />小写字母</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={value.requireDigit} onChange={() => toggle("requireDigit")} />数字</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={value.allowAt} onChange={() => toggle("allowAt")} />允许 @</label>
      </div>
      <p className="text-2xs text-muted-foreground">字符范围：字母、数字、下划线、短横线{value.allowAt ? "、@" : ""}。至少保留一种字母或数字要求。</p>
    </div>
  );
}
