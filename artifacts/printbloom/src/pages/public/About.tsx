import { useGetSettings } from '@workspace/api-client-react';

export default function About() {
  const { data: settings } = useGetSettings();

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-serif mb-6 leading-[1.1]">The story behind the print.</h1>
            <p className="text-lg text-primary-foreground/70 font-light leading-relaxed">
              {settings?.aboutMission || 'We believe that tactile experiences matter in a digital world. Every card, every banner, every invitation we print carries a piece of your story.'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="aspect-[4/5] bg-muted relative overflow-hidden">
              {settings?.aboutImage ? (
                <img src={settings.aboutImage} alt="About HAVESTORY" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-secondary/10 flex items-center justify-center">
                  <span className="text-secondary font-serif text-xl">HAVESTORY Studio</span>
                </div>
              )}
            </div>
            {/* Decorative element */}
            <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-secondary z-[-1] hidden md:block"></div>
          </div>
          
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-serif mb-6 text-foreground">Our Story</h2>
              <div className="prose prose-p:text-muted-foreground prose-p:leading-relaxed prose-headings:font-serif">
                <p>{settings?.aboutStory || 'Founded by a team of passionate designers and print specialists, PrintBloom was born out of a desire to bring true craftsmanship back to the printing industry in Sri Lanka.'}</p>
                <p>We combine traditional techniques with modern technology to deliver stunning results for our clients. Whether you're a startup looking for your first set of business cards or a couple planning the wedding of your dreams, we approach every project with the same level of dedication and care.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border">
              <div>
                <h4 className="text-4xl font-serif text-foreground mb-2">{settings?.aboutFoundedYear || '2020'}</h4>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Established</p>
              </div>
              <div>
                <h4 className="text-4xl font-serif text-foreground mb-2">{settings?.ordersCompletedCount || '10k+'}</h4>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Projects Delivered</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}